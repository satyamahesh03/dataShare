import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import InstallPWA from './components/InstallPWA';
import Home from './pages/Home';
import TextShare from './pages/TextShare';
import FileShare from './pages/FileShare';
import ViewShare from './pages/ViewShare';
import SearchPage from './pages/SearchPage';
import PublishedPosts from './pages/PublishedPosts';
import SecureText from './pages/SecureText';
import P2PReceive from './pages/P2PReceive';
import P2PSharePage from './pages/P2PSharePage';
import PaymentSuccess from './pages/PaymentSuccess';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import LoginModal from './components/LoginModal';
import PremiumModal from './components/PremiumModal';
import GlobalDragDrop from './components/GlobalDragDrop';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <GlobalDragDrop />
            <Header />
            <InstallPWA />
            <LoginModal />
            <PremiumModal />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Home />} />
              <Route path="/premium" element={<Home />} />
              <Route path="/payment/checkout/:orderId" element={<Home />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/success/:paymentId" element={<PaymentSuccess />} />
              <Route path="/text" element={<TextShare />} />
              <Route path="/file" element={<FileShare />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/posts" element={<PublishedPosts />} />
              <Route path="/secure/encrypt" element={<SecureText />} />
              <Route path="/secure/decrypt" element={<SecureText />} />
              {/* <Route path="/p2p" element={<P2PSharePage />} />
              <Route path="/p2p/:id" element={<P2PReceive />} /> */}
              <Route path="/share/:code" element={<ViewShare />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Footer />
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
