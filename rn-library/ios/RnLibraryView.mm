#import "RnLibraryView.h"

#import <react/renderer/components/RnLibraryViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/RnLibraryViewSpec/EventEmitters.h>
#import <react/renderer/components/RnLibraryViewSpec/Props.h>
#import <react/renderer/components/RnLibraryViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface RnLibraryView () <RCTRnLibraryViewViewProtocol>

@end

@implementation RnLibraryView {
    UIView * _view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<RnLibraryViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const RnLibraryViewProps>();
    _props = defaultProps;

    _view = [[UIView alloc] init];

    self.contentView = _view;
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<RnLibraryViewProps const>(_props);
    const auto &newViewProps = *std::static_pointer_cast<RnLibraryViewProps const>(props);
    if (oldViewProps.color != newViewProps.color) {
      if (newViewProps.color.compare("green")) {
        auto green = [UIColor colorWithRed:1.0f green:0.0f blue:0.0f alpha:1.0f];
        [_view setBackgroundColor:green];
      }
    }

    [super updateProps:props oldProps:oldProps];
}

Class<RCTComponentViewProtocol> RnLibraryViewCls(void)
{
    return RnLibraryView.class;
}

@end
