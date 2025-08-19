import AsyncStorage from '@react-native-async-storage/async-storage';

class DemoStateManager {
  constructor() {
    this.demoState = {
      currentStep: 'start', // start -> customer_order -> merchant_accept -> delivery_assign -> delivery_complete
      customerOrder: null,
      merchantStatus: 'waiting',
      deliveryStatus: 'available',
      lastUpdate: Date.now()
    };
    
    this.subscribers = [];
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  // Notify all subscribers
  notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.demoState));
  }

  // Update demo state
  async updateDemoState(updates) {
    this.demoState = {
      ...this.demoState,
      ...updates,
      lastUpdate: Date.now()
    };
    
    // Persist to storage
    await AsyncStorage.setItem('demoState', JSON.stringify(this.demoState));
    
    console.log('🎬 Demo state updated:', this.demoState);
    this.notifySubscribers();
  }

  // Load demo state
  async loadDemoState() {
    try {
      const saved = await AsyncStorage.getItem('demoState');
      if (saved) {
        this.demoState = JSON.parse(saved);
        console.log('🎬 Demo state loaded:', this.demoState);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load demo state:', error);
    }
    return this.demoState;
  }

  // Reset demo to initial state
  async resetDemo() {
    console.log('🎬 Resetting demo state');
    
    this.demoState = {
      currentStep: 'start',
      customerOrder: null,
      merchantStatus: 'waiting',
      deliveryStatus: 'available',
      lastUpdate: Date.now()
    };
    
    await AsyncStorage.setItem('demoState', JSON.stringify(this.demoState));
    this.notifySubscribers();
    
    // Clear other demo-related storage
    await AsyncStorage.removeItem('activeDelivery');
    await AsyncStorage.removeItem('demoOrder');
    
    console.log('✅ Demo reset complete');
  }

  // Demo flow progression methods
  async customerPlacesOrder(orderData) {
    await this.updateDemoState({
      currentStep: 'customer_order',
      customerOrder: orderData,
      merchantStatus: 'new_order'
    });
  }

  async merchantAcceptsOrder() {
    await this.updateDemoState({
      currentStep: 'merchant_accept',
      merchantStatus: 'preparing',
      deliveryStatus: 'order_ready'
    });
  }

  async merchantMarksReady() {
    await this.updateDemoState({
      merchantStatus: 'ready',
      deliveryStatus: 'ready_for_pickup'
    });
  }

  async deliveryAcceptsOrder() {
    await this.updateDemoState({
      currentStep: 'delivery_assign',
      deliveryStatus: 'assigned'
    });
  }

  async deliveryPicksUp() {
    await this.updateDemoState({
      deliveryStatus: 'picked_up'
    });
  }

  async deliveryCompletes() {
    await this.updateDemoState({
      currentStep: 'delivery_complete',
      deliveryStatus: 'completed',
      merchantStatus: 'completed'
    });
  }

  // Get current state
  getCurrentState() {
    return this.demoState;
  }

  // Check if demo is in specific step
  isStep(step) {
    return this.demoState.currentStep === step;
  }
}

export default new DemoStateManager();