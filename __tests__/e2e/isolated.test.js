// Isolated test - no imports from backend
describe('Isolated Test', () => {
  test('Basic Jest functionality', () => {
    expect(1 + 1).toBe(2);
  });

  test('Node.js environment check', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});