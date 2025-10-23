// Mock location service for demo
class MockLocationService {
  constructor() {
    this.demoLocation = {
      latitude: 18.4861,
      longitude: -69.9312,
      accuracy: 10,
      timestamp: Date.now()
    };
    
    this.isSimulating = false;
    this.simulationInterval = null;
  }

  async getCurrentPosition() {
    console.log('🎬 DEMO: Using mock location');
    return {
      coords: this.demoLocation
    };
  }

  startLocationUpdates(callback) {
    console.log('🎬 DEMO: Starting mock location updates');
    
    this.isSimulating = true;
    
    // Simulate movement for demo
    this.simulationInterval = setInterval(() => {
      if (this.isSimulating) {
        // Add small random movement
        this.demoLocation.latitude += (Math.random() - 0.5) * 0.0001;
        this.demoLocation.longitude += (Math.random() - 0.5) * 0.0001;
        this.demoLocation.timestamp = Date.now();
        
        callback({
          coords: this.demoLocation
        });
      }
    }, 5000); // Update every 5 seconds
  }

  stopLocationUpdates() {
    console.log('🎬 DEMO: Stopping mock location updates');
    this.isSimulating = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  // Mock delivery route simulation
  simulateDeliveryRoute(startCoords, endCoords, onUpdate) {
    console.log('🎬 DEMO: Simulating delivery route');
    
    const steps = 10;
    const latStep = (endCoords.latitude - startCoords.latitude) / steps;
    const lngStep = (endCoords.longitude - startCoords.longitude) / steps;
    
    let currentStep = 0;
    
    const routeInterval = setInterval(() => {
      if (currentStep >= steps) {
        clearInterval(routeInterval);
        console.log('🎬 DEMO: Delivery route simulation complete');
        return;
      }
      
      const currentPosition = {
        latitude: startCoords.latitude + (latStep * currentStep),
        longitude: startCoords.longitude + (lngStep * currentStep),
        timestamp: Date.now()
      };
      
      onUpdate(currentPosition);
      currentStep++;
    }, 2000); // Move every 2 seconds
  }

  // Mock distance calculation
  calculateDistance(lat1, lng1, lat2, lng2) {
    // Mock distance for demo - always return 2.5 km
    return 2.5;
  }
}

export default new MockLocationService();