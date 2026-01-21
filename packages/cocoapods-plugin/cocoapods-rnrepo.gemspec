# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'gem_version'

Gem::Specification.new do |spec|
  spec.name          = 'cocoapods-rnrepo'
  spec.version       = CocoapodsRnrepo::VERSION
  spec.authors       = ['Software Mansion']
  spec.email         = ['rnrepo@swmansion.com']
  spec.summary       = %q{Pre-built React Native frameworks for CocoaPods}
  spec.description   = %q{A CocoaPods plugin that replaces React Native local pods with pre-built xcframeworks from rnrepo.org Maven repository}
  spec.homepage      = 'https://rnrepo.org'
  spec.license       = 'MIT'

  spec.files         = Dir['lib/**/*'] + %w{README.md}
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})
  spec.require_paths = ['lib']

  spec.add_dependency 'cocoapods', '>= 1.0.0'
  spec.add_dependency 'rubyzip', '~> 2.3'

  spec.add_development_dependency 'bundler'
  spec.add_development_dependency 'rake'
end

