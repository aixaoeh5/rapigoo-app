import apiClient from './apiClient';

export async function getMyServices() {
  try {
    const { data } = await apiClient.get('/services/mine');
    if (!data.success) throw new Error(data.message);
    return data.data;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('❌ getMyServices:', msg);
    throw new Error(msg);
  }
}

export async function createOrUpdateService({
  id,
  image,
  title,
  price,
  category,
  description,
}) {
  try {
    console.log({
      image,
      title,
      price,
      category,
      description,
    });

    if (!image || !title || !price || !category || !description) {
      throw new Error('Todos los campos son obligatorios');
    }

    const { data } = await apiClient.post('/services', {
      id,
      image,
      title,
      price,
      category,
      description,
    });

    if (!data.success) throw new Error(data.message);
    return data.service;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('❌ createOrUpdateService:', msg);
    throw new Error(msg);
  }
}

export async function getServicesByMerchant(merchantId) {
  try {
    const { data } = await apiClient.get(`/services/${merchantId}`);
    if (!data.success) throw new Error(data.message);
    return data.data;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('❌ getServicesByMerchant:', msg);
    throw new Error(msg);
  }
}

export async function getMerchantPublicProfile(merchantId) {
  try {
    const { data } = await apiClient.get(`/merchant/public/${merchantId}`);
    if (!data.success) throw new Error(data.message);
    return data.data; 
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('❌ getMerchantPublicProfile:', msg);
    throw new Error(msg);
  }
}
