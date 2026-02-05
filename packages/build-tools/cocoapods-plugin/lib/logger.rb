module CocoapodsRnrepo
  class Logger
    # Colored prefix for logs
    def self.log_prefix
      "[📦 RNRepo]".cyan
    end

    # Log helper method
    def self.log(message)
      Pod::UI.puts "#{log_prefix} #{message}"
    end
  end
end

