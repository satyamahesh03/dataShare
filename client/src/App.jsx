import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import TextShare from './pages/TextShare';
import FileShare from './pages/FileShare';
import ViewShare from './pages/ViewShare';
import SearchPage from './pages/SearchPage';
import PublishedPosts from './pages/PublishedPosts';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Router>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/text" element={<TextShare />} />
            <Route path="/file" element={<FileShare />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/posts" element={<PublishedPosts />} />
            <Route path="/share/:code" element={<ViewShare />} />
          </Routes>
          <Footer />
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
