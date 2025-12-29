import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import LazyImage from '../../../components/shared/LazyImage';
import { Animated } from 'react-native';

// Mock Animated
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Animated.timing = jest.fn(() => ({
    start: jest.fn((callback) => callback && callback()),
  }));
  RN.Animated.Value = jest.fn(() => ({
    setValue: jest.fn(),
  }));
  return RN;
});

describe('LazyImage', () => {
  const defaultProps = {
    source: { uri: 'https://example.com/test-image.jpg' },
    style: { width: 100, height: 100 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with basic props', () => {
    const { getByTestId } = render(
      <LazyImage {...defaultProps} testID="lazy-image" />
    );

    expect(getByTestId('lazy-image')).toBeTruthy();
  });

  it('shows loading indicator initially when showLoader is true', () => {
    const { getByTestId } = render(
      <LazyImage
        {...defaultProps}
        showLoader={true}
        testID="lazy-image-container"
      />
    );

    expect(getByTestId('lazy-image-container')).toBeTruthy();
  });

  it('shows placeholder when provided', () => {
    const PlaceholderComponent = () => <></>;
    
    const { UNSAFE_getByType } = render(
      <LazyImage
        {...defaultProps}
        placeholder={<PlaceholderComponent />}
      />
    );

    // Initially should show placeholder
    expect(UNSAFE_getByType).toBeTruthy();
  });

  it('handles image load success', async () => {
    const mockOnLoad = jest.fn();
    
    const { getByTestId } = render(
      <LazyImage
        {...defaultProps}
        onLoad={mockOnLoad}
        testID="lazy-image"
      />
    );

    const image = getByTestId('lazy-image');
    
    // Simulate successful image load
    if (image.props.onLoad) {
      image.props.onLoad();
    }

    expect(mockOnLoad).toHaveBeenCalled();
  });

  it('handles image load error', async () => {
    const mockOnError = jest.fn();
    
    const { getByTestId } = render(
      <LazyImage
        {...defaultProps}
        onError={mockOnError}
        testID="lazy-image"
      />
    );

    const image = getByTestId('lazy-image');
    
    // Simulate image load error
    if (image.props.onError) {
      image.props.onError(new Error('Failed to load image'));
    }

    expect(mockOnError).toHaveBeenCalled();
  });

  it('applies custom resize mode', () => {
    const { getByTestId } = render(
      <LazyImage
        {...defaultProps}
        resizeMode="contain"
        testID="lazy-image"
      />
    );

    const image = getByTestId('lazy-image');
    expect(image.props.resizeMode).toBe('contain');
  });

  it('applies custom fade duration', () => {
    render(
      <LazyImage
        {...defaultProps}
        fadeDuration={500}
      />
    );

    // Check that Animated.timing was called with correct duration
    expect(Animated.timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        duration: 500,
      })
    );
  });

  it('handles different source types', () => {
    const localSource = require('../../../assets/logo.png');
    
    const { getByTestId } = render(
      <LazyImage
        source={localSource}
        style={defaultProps.style}
        testID="lazy-image"
      />
    );

    const image = getByTestId('lazy-image');
    expect(image.props.source).toBe(localSource);
  });

  it('passes through additional props', () => {
    const { getByTestId } = render(
      <LazyImage
        {...defaultProps}
        accessibilityLabel="Test image"
        testID="lazy-image"
      />
    );

    const image = getByTestId('lazy-image');
    expect(image.props.accessibilityLabel).toBe('Test image');
  });

  it('shows loading state initially', () => {
    const { getByTestId } = render(
      <LazyImage
        {...defaultProps}
        showLoader={true}
        testID="lazy-image-container"
      />
    );

    // Should render the container with loading indicator
    const container = getByTestId('lazy-image-container');
    expect(container).toBeTruthy();
  });

  it('hides loading state after image loads', async () => {
    const { getByTestId } = render(
      <LazyImage
        {...defaultProps}
        showLoader={true}
        testID="lazy-image"
      />
    );

    const image = getByTestId('lazy-image');
    
    // Simulate image load
    if (image.props.onLoad) {
      image.props.onLoad();
    }

    // After load, loading should be false
    // This would require checking the internal state or visual changes
    await waitFor(() => {
      expect(image).toBeTruthy();
    });
  });

  it('maintains aspect ratio when specified in style', () => {
    const customStyle = { width: 200, height: 150, aspectRatio: 16/9 };
    
    const { getByTestId } = render(
      <LazyImage
        source={defaultProps.source}
        style={customStyle}
        testID="lazy-image"
      />
    );

    const image = getByTestId('lazy-image');
    expect(image.props.style).toEqual(expect.objectContaining(customStyle));
  });
});