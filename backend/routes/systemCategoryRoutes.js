const express = require('express');
const SystemCategory = require('../models/SystemCategory');
const verifyToken = require('../middleware/verifyToken');
const { cachePresets } = require('../middleware/cache');
const router = express.Router();

// GET /api/system-categories - Obtener todas las categorías del sistema (público)
router.get('/', cachePresets.static, async (req, res) => {
  try {
    const categories = await SystemCategory.getActiveCategories();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching system categories:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error al obtener categorías',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/system-categories/:id - Obtener una categoría específica
router.get('/:id', cachePresets.static, async (req, res) => {
  try {
    const category = await SystemCategory.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Categoría no encontrada',
          code: 'CATEGORY_NOT_FOUND'
        }
      });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error al obtener categoría',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// POST /api/system-categories - Crear nueva categoría (solo admin)
router.post('/', verifyToken, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes permisos para realizar esta acción',
          code: 'FORBIDDEN'
        }
      });
    }

    const { name, description, icon, image, order } = req.body;

    const category = new SystemCategory({
      name,
      description,
      icon,
      image,
      order: order || 0
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: category
    });
  } catch (error) {
    console.error('Error creating category:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Ya existe una categoría con ese nombre',
          code: 'DUPLICATE_CATEGORY'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Error al crear categoría',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// PUT /api/system-categories/:id - Actualizar categoría (solo admin)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes permisos para realizar esta acción',
          code: 'FORBIDDEN'
        }
      });
    }

    const category = await SystemCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Categoría no encontrada',
          code: 'CATEGORY_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: category
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error al actualizar categoría',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// DELETE /api/system-categories/:id - Eliminar categoría (solo admin)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Verificar que el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes permisos para realizar esta acción',
          code: 'FORBIDDEN'
        }
      });
    }

    const category = await SystemCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Categoría no encontrada',
          code: 'CATEGORY_NOT_FOUND'
        }
      });
    }

    // En lugar de eliminar, desactivar
    category.isActive = false;
    await category.save();

    res.json({
      success: true,
      message: 'Categoría desactivada exitosamente'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error al eliminar categoría',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

module.exports = router;