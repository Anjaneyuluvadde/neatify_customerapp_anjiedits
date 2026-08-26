import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';

const CARD_WIDTH = 140;
const CARD_HEIGHT = 215; // Matches the calculated height of SimilarServices cards

interface ServiceHowItWorksVideosProps {
  serviceId: string;
}

interface VideoRecord {
  id: string;
  service_id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function ServiceHowItWorksVideos({ serviceId }: ServiceHowItWorksVideosProps) {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    fetchVideos();
  }, [serviceId]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("service_how_it_works_videos")
        .select("*")
        .eq("service_id", serviceId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("[ServiceHowItWorksVideos] Error fetching videos:", error);
        return;
      }
      setVideos(data || []);
    } catch (error) {
      console.error("[ServiceHowItWorksVideos] Exception fetching videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const togglePlayPause = () => setIsPlaying(prev => !prev);
  const toggleMute = () => setIsMuted(prev => !prev);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.saffron} />
      </View>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        snapToInterval={CARD_WIDTH + 12} // width + gap for centering the swipe
        decelerationRate="fast"
        contentContainerStyle={styles.flatListContent}
        renderItem={({ item, index }) => {
          const isActive = index === activeIndex && isScreenFocused;
          
          return (
            <View style={styles.cardWrapper}>
              <VideoCard 
                video={item}
                isActive={isActive}
                isPlaying={isPlaying}
                isMuted={isMuted}
                progressText={videos.length > 1 ? `${index + 1} / ${videos.length}` : ''}
                onTogglePlayPause={togglePlayPause}
                onToggleMute={toggleMute}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

interface VideoCardProps {
  video: VideoRecord;
  isActive: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  progressText: string;
  onTogglePlayPause: () => void;
  onToggleMute: () => void;
}

function VideoCard({ 
  video, 
  isActive, 
  isPlaying, 
  isMuted, 
  progressText, 
  onTogglePlayPause, 
  onToggleMute 
}: VideoCardProps) {

  const player = useVideoPlayer(video.video_url, p => {
    p.loop = true;
    p.muted = isMuted;
  });

  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (isActive && isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isPlaying, player]);

  return (
    <View style={styles.videoCard}>
      <Pressable style={styles.videoPressable} onPress={onTogglePlayPause}>
        <VideoView
          player={player}
          style={styles.videoView}
          contentFit="cover"
          nativeControls={false}
        />
        
        {/* Play/Pause Overlay Component */}
        {!isPlaying && isActive && (
          <View style={styles.playPauseOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={20} color="white" style={{ marginLeft: 2 }} />
            </View>
          </View>
        )}

        {/* Gradient Overlay at Bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.bottomGradient}
        >
          <View style={styles.bottomContent}>
            {/* Title */}
            {video.title ? (
              <Text style={styles.titleText} numberOfLines={2}>{video.title}</Text>
            ) : null}

            {/* Controls (Mute & Progress) */}
            <View style={styles.controlsRow}>
              {progressText ? (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressText}>{progressText}</Text>
                </View>
              ) : <View />}

              <Pressable onPress={onToggleMute} style={styles.muteButton}>
                <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={14} color="white" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    marginBottom: 24,
  },
  flatListContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardWrapper: {
    // Ensures the card participates nicely in the gap layout
  },
  videoCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  videoPressable: {
    flex: 1,
  },
  videoView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 30,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  bottomContent: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  titleText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  muteButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 6,
    borderRadius: 16,
  },
});
