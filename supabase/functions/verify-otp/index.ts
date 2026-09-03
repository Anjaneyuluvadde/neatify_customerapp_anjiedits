import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phone and OTP are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verify OTP with MSG91
    const msg91AuthKey = Deno.env.get('MSG91_AUTH_KEY');
    if (!msg91AuthKey) {
      throw new Error('Server configuration error: MSG91 Auth Key missing.');
    }

    const msg91Url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${phone}`;
    
    const msg91Response = await fetch(msg91Url, {
      method: 'GET',
      headers: {
        'authkey': msg91AuthKey
      }
    });
    
    const msg91Data = await msg91Response.json();
    
    if (msg91Data.type === 'error' || msg91Data.message?.toLowerCase().includes('error')) {
      return new Response(
        JSON.stringify({ success: false, message: msg91Data.message || 'Invalid OTP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Supabase URL or Service Key missing.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const formattedPhoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`;
    const dummyEmail = `temp_${phone.replace(/\D/g, "")}@neatify.app`;

    // 3. O(1) Check if User Exists & Create if Not
    let targetEmail = dummyEmail;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: dummyEmail,
      phone: formattedPhoneWithPlus,
      phone_confirm: true,
      email_confirm: true
    });

    if (createError) {
      if (createError.message.includes('already') || createError.status === 422) {
        // User already exists! 
        // We always use the dummyEmail because we don't update auth.users.email in the app.
        // It guarantees we use the email that was created via this same edge function.
        targetEmail = dummyEmail;
        
        // Wait, what if they were created via the old flow with their real email in auth.users?
        // Let's attempt to use their public.profile ID to fetch their actual auth.users email just to be safe.
        const { data: profile } = await supabaseAdmin
          .from('profile')
          .select('id')
          .eq('phone', phone.replace(/\D/g, "").slice(-10))
          .maybeSingle();

        if (profile?.id) {
          const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(profile.id);
          if (userAuth?.user?.email) {
            targetEmail = userAuth.user.email;
          }
        }
      } else {
        throw createError;
      }
    }

    // 4. Generate Session via Magic Link Trick
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail
    });

    if (linkError) {
      console.error("Link Generation Error:", linkError);
      throw linkError;
    }

    const token = linkData?.properties?.email_otp;
    if (!token) {
      throw new Error("Failed to extract backend OTP from generated link.");
    }

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      email: targetEmail,
      token: token,
      type: 'magiclink'
    });

    if (sessionError || !sessionData.session) {
      console.error("Session Generation Error:", sessionError);
      throw new Error("Failed to mint session token for client.");
    }

    // 5. Return Success with Session
    return new Response(
      JSON.stringify({ 
        success: true, 
        session: sessionData.session, 
        user: sessionData.user
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("verify-otp Error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
