#import "RNLegendAudio.h"
#import <AVFoundation/AVFoundation.h>
#import <MediaPlayer/MediaPlayer.h>
@interface RNLegendAudio ()
@property NSMutableDictionary<NSString *, AVPlayer *> *players;
@property NSString *activeID;
@property id playTarget;
@property id pauseTarget;
@end
@implementation RNLegendAudio
RCT_EXPORT_MODULE(NativeLegendAudio)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (instancetype)init { if (self = [super init]) {
  _players = [NSMutableDictionary new];
  __weak RNLegendAudio *weakSelf = self;
  MPRemoteCommandCenter *center = MPRemoteCommandCenter.sharedCommandCenter;
  _playTarget = [center.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) { RNLegendAudio *owner = weakSelf; AVPlayer *player = owner.players[owner.activeID ?: @""]; if (!player) return MPRemoteCommandHandlerStatusNoSuchContent; [player play]; return MPRemoteCommandHandlerStatusSuccess; }];
  _pauseTarget = [center.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent *event) { RNLegendAudio *owner = weakSelf; AVPlayer *player = owner.players[owner.activeID ?: @""]; if (!player) return MPRemoteCommandHandlerStatusNoSuchContent; [player pause]; return MPRemoteCommandHandlerStatusSuccess; }];
} return self; }
- (void)call:(NSString *)method args:(NSString *)json resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *args = [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    NSString *identifier = args[@"id"]; if (!identifier.length) { reject(@"E_AUDIO", @"Missing player id", nil); return; }
    AVPlayer *player = self.players[identifier]; id result = NSNull.null;
    if ([method isEqual:@"create"]) {
      NSString *uri = args[@"uri"]; NSURL *url = [uri hasPrefix:@"/"] ? [NSURL fileURLWithPath:uri] : [NSURL URLWithString:uri];
      if (!url || (!url.isFileURL && ![@[@"https", @"http"] containsObject:url.scheme])) { reject(@"E_AUDIO", @"Expected a local file or HTTP audio URL", nil); return; }
      if (url.isFileURL && ![NSFileManager.defaultManager isReadableFileAtPath:url.path]) { reject(@"E_NOT_FOUND", @"Audio file is not readable", nil); return; }
      self.players[identifier] = [AVPlayer playerWithURL:url]; self.activeID = identifier;
      MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo = @{MPMediaItemPropertyTitle: args[@"title"] ?: @"Music"};
    } else if (!player) { reject(@"E_AUDIO", @"Audio player is not available", nil); return; }
    else if ([method isEqual:@"ready"]) {
      NSError *error = player.error ?: player.currentItem.error;
      if (error) { reject(@"E_AUDIO", error.localizedDescription, error); return; }
      result = @(player.currentItem.status == AVPlayerItemStatusReadyToPlay);
    }
    else if ([method isEqual:@"play"]) { self.activeID = identifier; [player play]; }
    else if ([method isEqual:@"pause"]) [player pause];
    else if ([method isEqual:@"seek"]) {
      double seconds = [args[@"seconds"] doubleValue];
      if (!isfinite(seconds) || seconds < 0) { reject(@"E_AUDIO", @"Invalid seek position", nil); return; }
      [player seekToTime:CMTimeMakeWithSeconds(seconds, 600) toleranceBefore:kCMTimeZero toleranceAfter:kCMTimeZero completionHandler:^(BOOL finished) { if (finished) resolve(@"null"); else reject(@"E_AUDIO", @"Seek was interrupted", nil); }]; return;
    } else if ([method isEqual:@"status"]) {
      double position = CMTimeGetSeconds(player.currentTime), duration = CMTimeGetSeconds(player.currentItem.duration);
      if (!isfinite(position)) position = 0; if (!isfinite(duration)) duration = 0;
      NSError *error = player.error ?: player.currentItem.error;
      BOOL playing = player.timeControlStatus == AVPlayerTimeControlStatusPlaying;
      result = @{ @"playing": @(playing), @"currentTime": @(position), @"duration": @(duration), @"didJustFinish": @(duration > 0 && position >= duration && player.rate == 0), @"error": error.localizedDescription ?: NSNull.null };
      if ([self.activeID isEqual:identifier]) {
        NSMutableDictionary *info = [MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo mutableCopy] ?: [NSMutableDictionary new];
        info[MPMediaItemPropertyPlaybackDuration] = @(duration); info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(position); info[MPNowPlayingInfoPropertyPlaybackRate] = @(player.rate); MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo = info;
        MPNowPlayingInfoCenter.defaultCenter.playbackState = playing ? MPNowPlayingPlaybackStatePlaying : MPNowPlayingPlaybackStatePaused;
      }
    } else if ([method isEqual:@"remove"]) { [player pause]; [self.players removeObjectForKey:identifier]; if ([self.activeID isEqual:identifier]) { self.activeID = nil; MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo = nil; } }
    else { reject(@"E_AUDIO", @"Unknown audio operation", nil); return; }
    NSData *data = [NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingFragmentsAllowed error:nil]; resolve([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
  });
}
- (void)invalidate { dispatch_async(dispatch_get_main_queue(), ^{ for (AVPlayer *player in self.players.allValues) [player pause]; [self.players removeAllObjects]; MPRemoteCommandCenter *center = MPRemoteCommandCenter.sharedCommandCenter; [center.playCommand removeTarget:self.playTarget]; [center.pauseCommand removeTarget:self.pauseTarget]; MPNowPlayingInfoCenter.defaultCenter.nowPlayingInfo = nil; }); }
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params { return std::make_shared<facebook::react::NativeLegendAudioSpecJSI>(params); }
@end
