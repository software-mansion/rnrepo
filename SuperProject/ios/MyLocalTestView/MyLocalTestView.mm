#import "MyLocalTestView.h"

#import <react/renderer/components/AppSpec/ComponentDescriptors.h>
#import <react/renderer/components/AppSpec/EventEmitters.h>
#import <react/renderer/components/AppSpec/Props.h>
#import <react/renderer/components/AppSpec/RCTComponentViewHelpers.h>

// #import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface MyLocalTestView () <RCTMyLocalTestViewViewProtocol>

@end

@implementation MyLocalTestView {
    UIView * _view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<MyLocalTestViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const MyLocalTestViewProps>();
    _props = defaultProps;

    _view = [[UIView alloc] init];

    self.contentView = _view;
    NSLog(@"<<LOCAL>> INIT TEST");
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<MyLocalTestViewProps const>(_props);
    const auto &newViewProps = *std::static_pointer_cast<MyLocalTestViewProps const>(props);
    NSLog(@"<<LOCAL>> Update Props TEST");
    if (oldViewProps.color != newViewProps.color) {
      if (newViewProps.color.compare("green")) {
        auto green = [UIColor colorWithRed:50 / 255.0f green:168 / 255.0f blue:82 / 255.0f alpha:1.0f];
        [_view setBackgroundColor:green];
      }
    }

    [super updateProps:props oldProps:oldProps];
}

Class<RCTComponentViewProtocol> MyLocalTestViewCls(void)
{
    return MyLocalTestView.class;
}

@end
