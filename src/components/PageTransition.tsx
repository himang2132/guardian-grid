import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const PageTransition = forwardRef<HTMLDivElement, PageTransitionProps>(({ children }, ref) => {
  return (
    <motion.div
      ref={ref}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
});

PageTransition.displayName = 'PageTransition';

export default PageTransition;
