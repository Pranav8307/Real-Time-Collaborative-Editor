// Minimal app to test if Login component works
import { BrowserRouter } from 'react-router-dom';
import Login from './components/Login';
import './App.css';

export default function SimpleApp() {
  return (
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
}

