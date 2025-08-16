;; Compliance Registry Contract
;; Manages regulatory compliance and data protection requirements

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u500))
(define-constant ERR-COMPLIANCE-RECORD-NOT-FOUND (err u501))
(define-constant ERR-INVALID-REGULATION (err u502))
(define-constant ERR-AUDIT-FAILED (err u503))
(define-constant ERR-INVALID-INPUT (err u504))

;; Regulation Types
(define-constant REG-GDPR u0)
(define-constant REG-CCPA u1)
(define-constant REG-PIPEDA u2)
(define-constant REG-LGPD u3)

;; Data Variables
(define-data-var next-audit-id uint u1)
(define-data-var total-compliance-records uint u0)

;; Data Maps
(define-map compliance-records
  { identity-id: uint, regulation-type: uint }
  {
    owner: principal,
    compliance-status: bool,
    last-audit-date: uint,
    next-audit-due: uint,
    violations-count: uint,
    data-retention-period: uint,
    consent-records: (list 10 uint),
    created-at: uint,
    last-updated: uint
  }
)

(define-map audit-logs
  { audit-id: uint }
  {
    identity-id: uint,
    regulation-type: uint,
    auditor: principal,
    audit-date: uint,
    compliance-score: uint,
    findings: (string-ascii 500),
    recommendations: (string-ascii 500),
    passed: bool
  }
)

;; Private Functions
(define-private (is-valid-regulation-type (reg-type uint))
  (and (>= reg-type REG-GDPR) (<= reg-type REG-LGPD))
)

(define-private (get-next-audit-id)
  (let ((current-id (var-get next-audit-id)))
    (var-set next-audit-id (+ current-id u1))
    current-id
  )
)

;; Public Functions
(define-public (register-compliance (identity-id uint) (regulation-type uint) (retention-period uint))
  (let (
    (current-time (unwrap-panic (get-block-info? time (- block-height u1))))
  )
    (asserts! (is-valid-regulation-type regulation-type) ERR-INVALID-REGULATION)
    (asserts! (> retention-period u0) ERR-INVALID-INPUT)

    (map-set compliance-records
      { identity-id: identity-id, regulation-type: regulation-type }
      {
        owner: tx-sender,
        compliance-status: true,
        last-audit-date: current-time,
        next-audit-due: (+ current-time u31536000), ;; 1 year
        violations-count: u0,
        data-retention-period: retention-period,
        consent-records: (list),
        created-at: current-time,
        last-updated: current-time
      }
    )

    (var-set total-compliance-records (+ (var-get total-compliance-records) u1))
    (ok true)
  )
)

(define-public (conduct-audit (identity-id uint) (regulation-type uint) (compliance-score uint) (findings (string-ascii 500)))
  (let (
    (record (unwrap! (map-get? compliance-records { identity-id: identity-id, regulation-type: regulation-type }) ERR-COMPLIANCE-RECORD-NOT-FOUND))
    (audit-id (get-next-audit-id))
    (current-time (unwrap-panic (get-block-info? time (- block-height u1))))
    (passed (>= compliance-score u80))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= compliance-score u100) ERR-INVALID-INPUT)

    (map-set audit-logs
      { audit-id: audit-id }
      {
        identity-id: identity-id,
        regulation-type: regulation-type,
        auditor: tx-sender,
        audit-date: current-time,
        compliance-score: compliance-score,
        findings: findings,
        recommendations: "",
        passed: passed
      }
    )

    (map-set compliance-records
      { identity-id: identity-id, regulation-type: regulation-type }
      (merge record {
        compliance-status: passed,
        last-audit-date: current-time,
        next-audit-due: (+ current-time u31536000),
        violations-count: (if passed (get violations-count record) (+ (get violations-count record) u1)),
        last-updated: current-time
      })
    )

    (ok audit-id)
  )
)

;; Read-only Functions
(define-read-only (get-compliance-record (identity-id uint) (regulation-type uint))
  (map-get? compliance-records { identity-id: identity-id, regulation-type: regulation-type })
)

(define-read-only (get-audit-log (audit-id uint))
  (map-get? audit-logs { audit-id: audit-id })
)

(define-read-only (get-total-compliance-records)
  (var-get total-compliance-records)
)
