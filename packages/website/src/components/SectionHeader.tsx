import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  className = '',
  titleClassName = '',
  subtitleClassName = '',
}) => {
  return (
    <div className={className}>
      <h2
        className={`text-3xl md:text-4xl font-medium text-rnrGrey-0 mb-6 leading-tight ${titleClassName}`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`text-lg text-rnrGrey-40 leading-relaxed ${subtitleClassName}`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};
