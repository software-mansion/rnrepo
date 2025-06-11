#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>
#import "RCTBridge.h"

@interface RnLibraryViewManager : RCTViewManager
@end

@implementation RnLibraryViewManager

RCT_EXPORT_MODULE(RnLibraryView)

- (UIView *)view
{
  return [[UIView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(color, NSString)

@end
