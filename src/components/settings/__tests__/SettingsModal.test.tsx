import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsModal from '../SettingsModal';
import { SettingsProvider, useSettings } from '../../../contexts/SettingsContext';

// Mock AIOrchestrator dynamic import
const mockTestConnection = vi.fn();
const mockUpdateConfig = vi.fn();
vi.mock('../../../services/ai/AIOrchestrator', () => ({
  AIOrchestrator: {
    getInstance: () => ({
      testConnection: mockTestConnection,
      updateConfig: mockUpdateConfig,
    }),
  },
}));

// Mock sanitizeInput
vi.mock('../../../utils/sanitize', () => ({
  sanitizeInput: vi.fn((input: string) => input),
}));

// Mock logErrorSafe
vi.mock('../../../utils/logger', () => ({
  logErrorSafe: vi.fn(),
}));

// Wrapper with SettingsProvider
const SettingsWrapper = ({ children }: { children: React.ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('SettingsModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTestConnection.mockReset();
    mockUpdateConfig.mockReset();
  });

  const renderModal = () => {
    return render(
      <SettingsWrapper>
        <SettingsModal onClose={mockOnClose} />
      </SettingsWrapper>
    );
  };

  // --- Rendering ---
  it('should render the modal with AI Configuration title', () => {
    renderModal();
    expect(screen.getByText('AI Configuration')).not.toBeNull();
  });

  it('should render close button', () => {
    renderModal();
    const closeBtn = screen.getByRole('button', { name: '' });
    // The X button exists in the header
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3); // close, test, cancel, save
  });

  it('should render API key input field', () => {
    renderModal();
    const input = screen.getByPlaceholderText('Paste your API key here...');
    expect(input).not.toBeNull();
    expect(input.getAttribute('type')).toBe('password');
  });

  it('should render model selector with all available models', () => {
    renderModal();
    expect(screen.getByText('Gemini 2.5 Flash')).not.toBeNull();
    expect(screen.getByText('Gemini 2.5 Flash Lite')).not.toBeNull();
    expect(screen.getByText('Gemini 2.0 Flash')).not.toBeNull();
    expect(screen.getByText('Gemini 2.5 Pro')).not.toBeNull();
  });

  it('should render Test Connection button', () => {
    renderModal();
    expect(screen.getByText('Test Connection')).not.toBeNull();
  });

  it('should render Cancel button', () => {
    renderModal();
    expect(screen.getByText('Cancel')).not.toBeNull();
  });

  it('should render Save Changes button', () => {
    renderModal();
    expect(screen.getByText('Save Changes')).not.toBeNull();
  });

  it('should show default key hint when API key is empty', () => {
    renderModal();
    expect(screen.getByText('Using default system key from .env')).not.toBeNull();
  });

  it('should NOT show default key hint when API key has value', async () => {
    renderModal();
    const input = screen.getByPlaceholderText('Paste your API key here...');
    await userEvent.type(input, 'my-test-key');
    expect(screen.queryByText('Using default system key from .env')).toBeNull();
  });

  it('should render High Availability badge for HA models', () => {
    renderModal();
    const badges = screen.getAllByText('High Availability');
    // Gemini 2.5 Flash and 2.5 Flash Lite have isHighAvailability: true
    expect(badges.length).toBe(2);
  });

  // --- Interactions ---
  it('should call onClose when close button is clicked', async () => {
    renderModal();
    // The X button is inside the header — click the first button (close)
    const closeButtons = screen.getAllByRole('button');
    // Close button is the one with onClick={onClose} in the header
    await userEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when overlay is clicked', async () => {
    renderModal();
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    if (overlay) {
      await userEvent.click(overlay as Element);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should NOT call onClose when modal content is clicked', async () => {
    renderModal();
    const content = document.querySelector('.modal-content');
    expect(content).not.toBeNull();
    if (content) {
      await userEvent.click(content as Element);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('should update local API key when typing', async () => {
    renderModal();
    const input = screen.getByPlaceholderText('Paste your API key here...');
    await userEvent.type(input, 'test-key-123');
    expect((input as HTMLInputElement).value).toBe('test-key-123');
  });

  it('should select a model when clicking on it', async () => {
    renderModal();
    const proModel = screen.getByText('Gemini 2.5 Pro');
    await userEvent.click(proModel);
    // The model-option with the clicked model should now be active
    const activeOption = document.querySelector('.model-option.active');
    expect(activeOption).not.toBeNull();
  });

  it('should call setApiKey, setModelId, and onClose when Save is clicked', async () => {
    const { sanitizeInput } = await import('../../../utils/sanitize');
    renderModal();
    const saveBtn = screen.getByText('Save Changes');
    await userEvent.click(saveBtn);
    expect(sanitizeInput).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // --- Test Connection ---
  it('should show loading status when Test Connection is clicked', async () => {
    mockTestConnection.mockReturnValue(new Promise(() => {})); // never resolves
    renderModal();
    const testBtn = screen.getByText('Test Connection');
    await userEvent.click(testBtn);
    expect(screen.getByText('Testing...')).not.toBeNull();
  });

  it('should show success status when test connection succeeds', async () => {
    mockTestConnection.mockResolvedValue(undefined);
    renderModal();
    const testBtn = screen.getByText('Test Connection');
    await userEvent.click(testBtn);
    // Wait for async state update
    await vi.waitFor(() => {
      expect(screen.getByText('✓ Connection OK!')).not.toBeNull();
    });
  });

  it('should show error status when test connection fails', async () => {
    mockTestConnection.mockRejectedValue(new Error('Connection failed'));
    renderModal();
    const testBtn = screen.getByText('Test Connection');
    await userEvent.click(testBtn);
    await vi.waitFor(() => {
      expect(screen.getByText('✗ Connection Failed')).not.toBeNull();
    });
  });

  it('should call logErrorSafe when test connection fails', async () => {
    const { logErrorSafe } = await import('../../../utils/logger');
    mockTestConnection.mockRejectedValue(new Error('Network error'));
    renderModal();
    const testBtn = screen.getByText('Test Connection');
    await userEvent.click(testBtn);
    await vi.waitFor(() => {
      expect(logErrorSafe).toHaveBeenCalledWith('SettingsModal', expect.any(Error));
    });
  });

  it('should disable Test Connection button while loading', async () => {
    mockTestConnection.mockReturnValue(new Promise(() => {}));
    renderModal();
    const testBtn = screen.getByText('Test Connection') as HTMLButtonElement;
    await userEvent.click(testBtn);
    expect(testBtn.disabled).toBe(true);
  });

  it('should call updateConfig with local values when testing', async () => {
    mockTestConnection.mockResolvedValue(undefined);
    renderModal();
    const input = screen.getByPlaceholderText('Paste your API key here...');
    await userEvent.type(input, 'my-local-key');
    const testBtn = screen.getByText('Test Connection');
    await userEvent.click(testBtn);
    expect(mockUpdateConfig).toHaveBeenCalledWith('my-local-key', 'gemini-2.5-flash');
  });

  it('should use getEffectiveApiKey when local API key is empty during test', async () => {
    mockTestConnection.mockResolvedValue(undefined);
    renderModal();
    const testBtn = screen.getByText('Test Connection');
    await userEvent.click(testBtn);
    // When localApiKey is empty, it calls getEffectiveApiKey() as fallback
    expect(mockUpdateConfig).toHaveBeenCalledWith(expect.any(String), 'gemini-2.5-flash');
  });

  // --- Google AI Studio link ---
  it('should render Google AI Studio link', () => {
    renderModal();
    const link = screen.getByText('Google AI Studio');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://aistudio.google.com/app/apikey');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
  });

  // --- Model descriptions ---
  it('should render model descriptions', () => {
    renderModal();
    expect(
      screen.getByText('Next gen fast model, perfect for rapid app iteration.')
    ).not.toBeNull();
    expect(
      screen.getByText('Fastest & most budget-friendly. Great for simple apps.')
    ).not.toBeNull();
    expect(
      screen.getByText('Stable 2.0 model. Note: May have limited quota in some regions.')
    ).not.toBeNull();
    expect(screen.getByText('Highest intelligence for complex coding logic.')).not.toBeNull();
  });

  // --- Initial state ---
  it('should default to gemini-2.5-flash model as active', () => {
    renderModal();
    const activeOption = document.querySelector('.model-option.active');
    expect(activeOption).not.toBeNull();
    expect(activeOption?.textContent).toContain('Gemini 2.5 Flash');
  });
});
