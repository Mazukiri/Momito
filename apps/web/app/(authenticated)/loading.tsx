import { LoadingPage } from '../components/ui';

// MOM-084: shown during server-rendered route transitions within the
// authenticated section, before the route's own data-fetching UI takes over.
export default function AuthenticatedLoading() {
  return <LoadingPage />;
}
