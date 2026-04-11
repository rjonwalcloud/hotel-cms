const authService = require('../services/auth.service');

class AuthController {

  /**
   * POST /api/auth/login
   * Login user
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Email and password are required'
        });
      }

      const result = await authService.login(email, password);

      res.json({
        success: true,
        message: 'Login successful',
        ...result
      });
    } catch (error) {
      if (error.message === 'Invalid credentials' || error.message === 'Account is deactivated') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Get current user info
   */
  async getCurrentUser(req, res) {
    try {
      res.json({
        success: true,
        user: req.user
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  }

  /**
   * POST /api/auth/change-password
   * Change user password
   */
  async changePassword(req, res, next) {
    try {
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Old and new passwords are required'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'New password must be at least 8 characters'
        });
      }

      await authService.changePassword(req.user.id, oldPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      if (error.message === 'Current password is incorrect') {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = new AuthController();
