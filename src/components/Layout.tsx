import { ReactNode } from 'react';
import BottomNav from './BottomNav';

interface LayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export default function Layout({ children, hideNav = false }: LayoutProps) {
  return (
    <div className="app-container">
      <div className={hideNav ? '' : 'pb-24'}>
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
