import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Login from './screens/Login';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Login />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
