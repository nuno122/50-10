import { AuthProvider } from './contexts/AuthContext';
import Login from './screens/Login';

function App() {
  return (
    <AuthProvider>
      <Login />
    </AuthProvider>
  );
}

export default App;
