"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settingsController_1 = require("../controllers/settingsController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Protect all routes with authentication
router.use(auth_1.authenticateToken);
// Accessible by all employees and admins
router.get('/', settingsController_1.getHolidays);
// Admin-only operations
router.post('/', auth_1.adminOnly, settingsController_1.addHoliday);
router.delete('/:id', auth_1.adminOnly, settingsController_1.deleteHoliday);
exports.default = router;
