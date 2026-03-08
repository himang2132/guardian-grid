import React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="relative p-2 rounded-lg bg-secondary/50 hover:bg-secondary border border-border transition-colors"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Sun className="h-4 w-4 text-foreground rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute top-2 left-2 h-4 w-4 text-foreground rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};

export default ThemeToggle;
