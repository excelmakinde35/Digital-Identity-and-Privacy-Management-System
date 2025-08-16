import { describe, it, expect, beforeEach } from "vitest"

// Mock compliance registry contract
const mockComplianceContract = {
  complianceRecords: new Map(),
  auditLogs: new Map(),
  nextAuditId: 1,
  totalComplianceRecords: 0,
  contractOwner: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
}

const REG_GDPR = 0
const REG_CCPA = 1
const REG_PIPEDA = 2
const REG_LGPD = 3

function registerCompliance(identityId, regulationType, retentionPeriod, sender) {
  if (regulationType < REG_GDPR || regulationType > REG_LGPD) {
    return { error: "ERR-INVALID-REGULATION" }
  }
  
  if (retentionPeriod <= 0) {
    return { error: "ERR-INVALID-INPUT" }
  }
  
  const recordKey = `${identityId}-${regulationType}`
  const currentTime = Date.now()
  
  const record = {
    owner: sender,
    complianceStatus: true,
    lastAuditDate: currentTime,
    nextAuditDue: currentTime + 31536000000, // 1 year
    violationsCount: 0,
    dataRetentionPeriod: retentionPeriod,
    consentRecords: [],
    createdAt: currentTime,
    lastUpdated: currentTime,
  }
  
  mockComplianceContract.complianceRecords.set(recordKey, record)
  mockComplianceContract.totalComplianceRecords++
  
  return { success: true }
}

function conductAudit(identityId, regulationType, complianceScore, findings, sender) {
  if (sender !== mockComplianceContract.contractOwner) {
    return { error: "ERR-NOT-AUTHORIZED" }
  }
  
  const recordKey = `${identityId}-${regulationType}`
  const record = mockComplianceContract.complianceRecords.get(recordKey)
  
  if (!record) {
    return { error: "ERR-COMPLIANCE-RECORD-NOT-FOUND" }
  }
  
  if (complianceScore > 100) {
    return { error: "ERR-INVALID-INPUT" }
  }
  
  const auditId = mockComplianceContract.nextAuditId++
  const currentTime = Date.now()
  const passed = complianceScore >= 80
  
  const audit = {
    identityId: identityId,
    regulationType: regulationType,
    auditor: sender,
    auditDate: currentTime,
    complianceScore: complianceScore,
    findings: findings,
    recommendations: "",
    passed: passed,
  }
  
  mockComplianceContract.auditLogs.set(auditId, audit)
  
  // Update compliance record
  record.complianceStatus = passed
  record.lastAuditDate = currentTime
  record.nextAuditDue = currentTime + 31536000000
  record.violationsCount = passed ? record.violationsCount : record.violationsCount + 1
  record.lastUpdated = currentTime
  
  return { success: auditId }
}

describe("Compliance Registry Contract", () => {
  beforeEach(() => {
    mockComplianceContract.complianceRecords.clear()
    mockComplianceContract.auditLogs.clear()
    mockComplianceContract.nextAuditId = 1
    mockComplianceContract.totalComplianceRecords = 0
  })
  
  describe("register-compliance", () => {
    it("should register compliance successfully", () => {
      const identityId = 1
      const regulationType = REG_GDPR
      const retentionPeriod = 365
      const sender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      
      const result = registerCompliance(identityId, regulationType, retentionPeriod, sender)
      
      expect(result.success).toBe(true)
      expect(mockComplianceContract.totalComplianceRecords).toBe(1)
      
      const recordKey = `${identityId}-${regulationType}`
      const record = mockComplianceContract.complianceRecords.get(recordKey)
      expect(record.owner).toBe(sender)
      expect(record.complianceStatus).toBe(true)
      expect(record.dataRetentionPeriod).toBe(retentionPeriod)
    })
    
    it("should reject invalid regulation type", () => {
      const identityId = 1
      const invalidRegulationType = 5
      const retentionPeriod = 365
      const sender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      
      const result = registerCompliance(identityId, invalidRegulationType, retentionPeriod, sender)
      
      expect(result.error).toBe("ERR-INVALID-REGULATION")
    })
    
    it("should reject invalid retention period", () => {
      const identityId = 1
      const regulationType = REG_GDPR
      const invalidRetentionPeriod = 0
      const sender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
      
      const result = registerCompliance(identityId, regulationType, invalidRetentionPeriod, sender)
      
      expect(result.error).toBe("ERR-INVALID-INPUT")
    })
  })
  
  describe("conduct-audit", () => {
    it("should conduct audit successfully", () => {
      const identityId = 1
      const regulationType = REG_GDPR
      const sender = mockComplianceContract.contractOwner
      
      registerCompliance(identityId, regulationType, 365, sender)
      
      const result = conductAudit(identityId, regulationType, 85, "Good compliance", sender)
      
      expect(result.success).toBe(1)
      
      const audit = mockComplianceContract.auditLogs.get(1)
      expect(audit.complianceScore).toBe(85)
      expect(audit.passed).toBe(true)
      
      const recordKey = `${identityId}-${regulationType}`
      const record = mockComplianceContract.complianceRecords.get(recordKey)
      expect(record.complianceStatus).toBe(true)
      expect(record.violationsCount).toBe(0)
    })
    
    it("should fail audit with low score", () => {
      const identityId = 1
      const regulationType = REG_GDPR
      const sender = mockComplianceContract.contractOwner
      
      registerCompliance(identityId, regulationType, 365, sender)
      
      const result = conductAudit(identityId, regulationType, 60, "Poor compliance", sender)
      
      expect(result.success).toBe(1)
      
      const audit = mockComplianceContract.auditLogs.get(1)
      expect(audit.passed).toBe(false)
      
      const recordKey = `${identityId}-${regulationType}`
      const record = mockComplianceContract.complianceRecords.get(recordKey)
      expect(record.complianceStatus).toBe(false)
      expect(record.violationsCount).toBe(1)
    })
    
    it("should reject unauthorized audit", () => {
      const identityId = 1
      const regulationType = REG_GDPR
      const unauthorizedSender = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG"
      
      registerCompliance(identityId, regulationType, 365, mockComplianceContract.contractOwner)
      
      const result = conductAudit(identityId, regulationType, 85, "Test", unauthorizedSender)
      
      expect(result.error).toBe("ERR-NOT-AUTHORIZED")
    })
  })
})
