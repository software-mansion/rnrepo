#import "MyFrameworkTestView.h"

#import <react/renderer/components/FrameworkSpec/ComponentDescriptors.h>
#import <react/renderer/components/FrameworkSpec/EventEmitters.h>
#import <react/renderer/components/FrameworkSpec/Props.h>
#import <react/renderer/components/FrameworkSpec/RCTComponentViewHelpers.h>


// #import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface MyFrameworkTestView () <RCTMyFrameworkTestViewViewProtocol>

@end

@implementation MyFrameworkTestView {
    UIView * _view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<MyFrameworkTestViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  NSLog(@"TETETE!");
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const MyFrameworkTestViewProps>();
    _props = defaultProps;

    _view = [[UIView alloc] init];

    self.contentView = _view;
    NSLog(@"INIT TEST");
  }

  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<MyFrameworkTestViewProps const>(_props);
    const auto &newViewProps = *std::static_pointer_cast<MyFrameworkTestViewProps const>(props);
    NSLog(@"Update Props TEST");
     if (oldViewProps.color != newViewProps.color) {
       if (newViewProps.color.compare("green")) {
         auto green = [UIColor colorWithRed:50 / 255.0f green:168 / 255.0f blue:82 / 255.0f alpha:1.0f];
         [_view setBackgroundColor:green];
       }
     }

    [super updateProps:props oldProps:oldProps];
}

Class<RCTComponentViewProtocol> MyFrameworkTestViewCls(void)
{
    return MyFrameworkTestView.class;
}

@end
