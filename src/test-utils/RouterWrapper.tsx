import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

interface RouterWrapperProps {
  children: ReactNode;
  initialEntries?: string[];
}

/**
 * Test utility: wraps children in a MemoryRouter for routing context.
 * Use in tests that need react-router-dom hooks (useLocation, useNavigate, etc.)
 *
 * @example
 * render(<RouterWrapper><MyComponent /></RouterWrapper>)
 * render(<RouterWrapper initialEntries={['/showcase']}><MyComponent /></RouterWrapper>)
 */
export function RouterWrapper({ children, initialEntries = ['/'] }: RouterWrapperProps) {
  return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
}
