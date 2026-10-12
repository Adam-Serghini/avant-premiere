import { createRoot } from 'react-dom/client';
import './theme.css';
import { OverlayPage } from './overlay/OverlayPage';
import { PrepPage } from './prep/PrepPage';
import { RegiePage } from './regie/RegiePage';

const path = window.location.pathname.replace(/\/+$/, '') || '/';

function Page() {
  switch (path) {
    case '/regie':
      return <RegiePage />;
    case '/overlay':
      return <OverlayPage />;
    default:
      return <PrepPage />;
  }
}

createRoot(document.getElementById('root')!).render(<Page />);
