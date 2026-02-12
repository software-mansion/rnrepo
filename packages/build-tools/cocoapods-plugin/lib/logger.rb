# frozen_string_literal: true

module CocoapodsRnrepo
  # Simple logger for RNRepo CocoaPods plugin with colored output.
  class Logger
    # Colored prefix for logs
    def self.log_prefix
      '[📦 RNRepo]'.cyan
    end

    # Log helper method
    def self.log(message)
      Pod::UI.puts "#{log_prefix} #{message}"
    end
  end
end
