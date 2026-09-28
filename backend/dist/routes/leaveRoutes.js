"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leaveController_1 = require("../controllers/leaveController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken); // Protect all leave routes
router.get('/balance', leaveController_1.getBalances);
router.get('/validate', leaveController_1.validateLeave);
router.post('/validate', leaveController_1.validateLeave);
router.post('/', leaveController_1.applyLeave);
router.get('/', leaveController_1.getLeaveHistory);
router.get('/:id', leaveController_1.getLeaveRequest);
router.patch('/:id/cancel', leaveController_1.cancelLeave);
exports.default = router;
