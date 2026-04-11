import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import {
  Hotel,
  Search,
  Calendar,
  QrCode,
  BarChart3,
  Users,
  ShieldCheck,
  Clock,
  MessageCircle,
  ChevronRight,
  Settings,
  Zap,
  LayoutDashboard
} from 'lucide-react';
import './LandingPage.css';

const LandingPage = () => {
  const { isAuthenticated } = useAuthStore();
  const whatsappNumber = "+918860601030"; // Placeholder as requested
  const whatsappMessage = encodeURIComponent("Hello! I'm interested in the Hotel CMS.");

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-container">
      {/* Decorative Orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
      
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <Hotel className="inline mr-2" size={24} />
          HOTEL CMS
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#solutions">Solutions</a>
          <a href="#contact">Contact</a>
          <Link to="/login" className="btn-login">Partner Login</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="badge mb-4 bg-primary/10 text-primary px-4 py-1 rounded-full inline-block border border-primary/20">
            Next-Gen Hospitality Solution
          </div>
          <h1>Manage Your <span className="text-gradient glow-text">Hotel Empire</span> with Precision</h1>
          <p>
            An all-in-one cloud platform for modern hoteliers. From seamless bookings
            to QR-based guest experiences, we provide the tools you need to scale
            your hospitality business.
          </p>
          <div className="hero-btns flex gap-4">
            <Link to="/login" className="btn-primary flex items-center gap-2">
              Get Started Free <ChevronRight size={20} />
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <img
            src="/assets/landing/hero.png"
            alt="Modern Hotel Management Dashboard"
            className="hero-image"
          />
        </div>
      </section>

      {/* Stats / Proof */}
      <section className="stats py-12 bg-white/5 border-y border-white/10 text-center">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-3xl font-bold">500+</h3>
            <p className="text-muted">Hotels Managed</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold">1M+</h3>
            <p className="text-muted">Guests Served</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold">99.9%</h3>
            <p className="text-muted">Uptime</p>
          </div>
          <div>
            <h3 className="text-3xl font-bold">24/7</h3>
            <p className="text-muted">Expert Support</p>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="section">
        <h2 className="section-title">Everything you need to <span className="text-gradient">Outperform</span></h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><Calendar size={32} /></div>
            <h3>Smart Bookings</h3>
            <p className="text-muted">Manage online and offline reservations with an intuitive calendar view and real-time inventory sync.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Zap size={32} /></div>
            <h3>Premium POS</h3>
            <p className="text-muted">Accelerate your restaurant operations with a high-speed Point of Sale. Guest assignment and kitchen printing included.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><BarChart3 size={32} /></div>
            <h3>Advanced Analytics</h3>
            <p className="text-muted">Track revenue trends, occupancy rates, and performance metrics with interactive visual dashboards.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><ShieldCheck size={32} /></div>
            <h3>Tax & Invoicing</h3>
            <p className="text-muted">Automated itemized invoicing with global tax support (GST/VAT) and sequential billing counters.</p>
          </div>
        </div>
      </section>

      {/* QR Code Highlight */}
      <section id="solutions" className="section highlight-section">
        <div className="highlight-image-container flex justify-center">
          <img
            src="/assets/landing/qr_scan.png"
            alt="Guest Scanning QR Code"
            className="highlight-image"
          />
        </div>
        <div className="highlight-content">
          <div className="feature-icon"><QrCode size={40} /></div>
          <h2 className="text-3xl font-bold mt-4 mb-6">Revolutionize <span className="text-gradient">Guest Experience</span></h2>
          <p className="text-lg text-muted mb-8">
            Empower your guests with our touchless service ecosystem. By scanning a unique QR code
            in their room, guests can:
          </p>
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <Zap className="text-accent" size={20} /> Order Room Service Instantly
            </li>
            <li className="flex items-center gap-3">
              <Zap className="text-accent" size={20} /> View Digital House Manuals
            </li>
            <li className="flex items-center gap-3">
              <Zap className="text-accent" size={20} /> Request Maintenance or Housekeeping
            </li>
          </ul>
        </div>
      </section>

      {/* Revenue Highlight */}
      <section className="section highlight-section reverse">
        <div className="highlight-image-container flex justify-center">
          <img
            src="/assets/landing/revenue.png"
            alt="Revenue Dashboard"
            className="highlight-image"
          />
        </div>
        <div className="highlight-content">
          <div className="feature-icon"><BarChart3 size={40} /></div>
          <h2 className="text-3xl font-bold mt-4 mb-6">Maximize <span className="text-gradient">Profitability</span></h2>
          <p className="text-lg text-muted mb-8">
            Our advanced rate management engine helps you sell at the right price, every time.
          </p>
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <Zap className="text-secondary" size={20} /> Dynamic Pricing & Seasonal Rules
            </li>
            <li className="flex items-center gap-3">
              <Zap className="text-secondary" size={20} /> Revenue, ADR & RevPAR Analytics
            </li>
            <li className="flex items-center gap-3">
              <Zap className="text-secondary" size={20} /> Multi-Channel Sync (OTA Integration)
            </li>
          </ul>
        </div>
      </section>

      {/* CTA Section */}
      <div id="contact" className="cta-section">
        <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Hotel?</h2>
        <p className="text-xl text-muted mb-10 max-w-2xl mx-auto">
          Join hundreds of innovative hoteliers who are scaling their businesses with
          Hotel CMS. Get in touch for a personalized demo.
        </p>
        <div className="flex justify-center gap-6 flex-wrap">
          <a href={`https://wa.me/${whatsappNumber.replace('+', '')}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2">
            <MessageCircle size={20} /> Chat with Sales
          </a>
          <Link to="/login" className="px-10 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold transition-all">
            See Pricing
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="nav-logo">
            <Hotel className="inline mr-2" size={24} />
            HOTEL CMS
          </div>
          <div className="text-muted text-sm">
            © 2026 Hotel CMS Platform. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-muted hover:text-white transition-colors">Privacy</a>
            <a href="#" className="text-muted hover:text-white transition-colors">Terms</a>
            <a href="#" className="text-muted hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <a
        href={`https://wa.me/${whatsappNumber.replace('+', '')}?text=${whatsappMessage}`}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-float"
        title="Chat with us on WhatsApp"
      >
        <MessageCircle size={30} color="white" fill="currentColor" />
      </a>
    </div>
  );
};

export default LandingPage;
