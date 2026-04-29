import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { RouterWrapper } from '../RouterWrapper';

/**
 * LPL-001: Test that react-router-dom is importable
 * and MemoryRouter wraps without crash, providing routing context.
 */
describe('LPL-001: react-router-dom import and routing context', () => {
  it('imports MemoryRouter from react-router-dom', () => {
    // If react-router-dom is not installed, this import fails at module level.
    // By reaching this assertion, we prove the import works.
    expect(MemoryRouter).toBeDefined();
    expect(typeof MemoryRouter).toBe('function');
  });

  it('imports Routes and Route from react-router-dom', () => {
    expect(Routes).toBeDefined();
    expect(Route).toBeDefined();
  });

  it('wraps children in MemoryRouter without crashing', () => {
    function Child() {
      return <div data-testid="routed-child">Routed Content</div>;
    }

    const { container } = render(
      <MemoryRouter>
        <Child />
      </MemoryRouter>
    );

    // Behavioral assertion: the child actually renders inside the router context
    expect(screen.getByTestId('routed-child')).toHaveTextContent('Routed Content');
    expect(container.querySelector('[data-testid="routed-child"]')).not.toBeNull();
  });

  it('renders multiple children inside MemoryRouter', () => {
    function Nav() {
      return <nav data-testid="nav-bar">Navigation</nav>;
    }
    function Main() {
      return <main data-testid="main-content">Main Area</main>;
    }

    render(
      <MemoryRouter>
        <Nav />
        <Main />
      </MemoryRouter>
    );

    // Both children render — proves router context propagates
    expect(screen.getByTestId('nav-bar')).toHaveTextContent('Navigation');
    expect(screen.getByTestId('main-content')).toHaveTextContent('Main Area');
  });

  it('renders a Route that matches the default path "/"', () => {
    function Home() {
      return <h1 data-testid="home-page">Home Page</h1>;
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </MemoryRouter>
    );

    // Route matching is real — "/" renders Home, not nothing
    expect(screen.getByTestId('home-page')).toHaveTextContent('Home Page');
  });

  it('renders different content for different routes', () => {
    function Home() {
      return <h1 data-testid="home-page">Home</h1>;
    }
    function About() {
      return <h1 data-testid="about-page">About</h1>;
    }

    const { rerender } = render(
      <MemoryRouter initialEntries={['/about']}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </MemoryRouter>
    );

    // At /about, we see About — NOT Home
    expect(screen.getByTestId('about-page')).toHaveTextContent('About');
    expect(screen.queryByTestId('home-page')).toBeNull();
  });
});

/**
 * LPL-002: Test that RouterWrapper (MemoryRouter test wrapper)
 * renders components with routing context.
 */
describe('LPL-002: RouterWrapper renders components with routing context', () => {
  it('wraps children in routing context without crashing', () => {
    function Child() {
      return <div data-testid="wrapper-child">Wrapped Content</div>;
    }

    render(
      <RouterWrapper>
        <Child />
      </RouterWrapper>
    );

    // The child actually renders inside the wrapper's router context
    expect(screen.getByTestId('wrapper-child')).toHaveTextContent('Wrapped Content');
  });

  it('provides routing context so useLocation works inside children', () => {
    function LocationDisplay() {
      const location = useLocation();
      return <span data-testid="location-pathname">{location.pathname}</span>;
    }

    render(
      <RouterWrapper>
        <LocationDisplay />
      </RouterWrapper>
    );

    // Default initialEntry is '/', so pathname should be '/'
    expect(screen.getByTestId('location-pathname')).toHaveTextContent('/');
  });

  it('renders multiple children inside the routing context', () => {
    function Header() {
      return <header data-testid="header">App Header</header>;
    }
    function Body() {
      return <main data-testid="body">App Body</main>;
    }

    render(
      <RouterWrapper>
        <Header />
        <Body />
      </RouterWrapper>
    );

    expect(screen.getByTestId('header')).toHaveTextContent('App Header');
    expect(screen.getByTestId('body')).toHaveTextContent('App Body');
  });
});
