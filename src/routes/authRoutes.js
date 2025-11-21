// src/routes/authRoutes.js
const express = require('express');
const { body } = require('express-validator');

const createAuthRoutes = (authController, validationMiddleware, authMiddleware) => {
  const router = express.Router();

  // Validation rules
  const signUpValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty().trim()
  ];

  const signInValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ];

  const refreshTokenValidation = [
    body('refreshToken').notEmpty()
  ];

  const forgotPasswordValidation = [
    body('email').isEmail().normalizeEmail()
  ];

  const resetPasswordValidation = [
    body('token').notEmpty(),
    body('userId').notEmpty(),
    body('newPassword').isLength({ min: 6 })
  ];

  // Routes
  router.post('/signup', signUpValidation, validationMiddleware, authController.signUp);
  router.post('/signin', signInValidation, validationMiddleware, authController.signIn);
  router.post('/refresh-token', refreshTokenValidation, validationMiddleware, authController.refreshToken);
  router.post('/forgot-password', forgotPasswordValidation, validationMiddleware, authController.forgotPassword);
  router.post('/reset-password', resetPasswordValidation, validationMiddleware, authController.resetPassword);
  router.post('/signout', authController.signOut);
  
  // FIXED: Use the provided authMiddleware for protected routes
  router.get('/me', authMiddleware, authController.getCurrentUser);

  return router;
};

module.exports = createAuthRoutes;