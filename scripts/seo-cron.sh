#!/bin/bash
# =============================================================================
# IndieCrowdfund SEO Cron Job
# =============================================================================
#
# Runs a comprehensive SEO audit of the site daily.
# Checks all pages for missing/incomplete meta tags, scores them, and logs results.
#
# SETUP:
# 1. Set your SEO_CRON_API_KEY in .env:
#      SEO_CRON_API_KEY=your-secret-key-here
#
# 2. Make this script executable:
#      chmod +x scripts/seo-cron.sh
#
# 3. Add to crontab (runs daily at 3 AM):
#      crontab -e
#      0 3 * * * /path/to/indiecrowdfund_2.0/scripts/seo-cron.sh >> /var/log/indiecrowdfund-seo-cron.log 2>&1
#
# OR use the direct curl command in crontab:
#      0 3 * * * curl -s "https://www.indiecrowdfund.com/api/admin/seo/cron?apiKey=YOUR_API_KEY" -X POST -H "Content-Type: application/json" >> /var/log/indiecrowdfund-seo-cron.log 2>&1
#
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="/var/log"
LOG_FILE="$LOG_DIR/indiecrowdfund-seo-cron.log"
MAX_LOG_SIZE=10485760  # 10MB
MAX_RETRIES=3
RETRY_DELAY=10

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
elif [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a
  source "$PROJECT_DIR/.env.local"
  set +a
fi

# Use environment variable or default
SITE_URL="${NEXT_PUBLIC_APP_URL:-https://www.indiecrowdfund.com}"
API_KEY="${SEO_CRON_API_KEY:-}"

# Colors for terminal output (when run manually)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
  local level="$1"
  shift
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${timestamp} [${level}] $*"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "${YELLOW}$*${NC}"; }
log_error() { log "ERROR" "${RED}$*${NC}"; }
log_success() { log "OK" "${GREEN}$*${NC}"; }

# Rotate log if too large
rotate_log() {
  if [ -f "$LOG_FILE" ] && [ "$(stat -f%z "$LOG_FILE" 2>/dev/null || stat --printf="%s" "$LOG_FILE" 2>/dev/null)" -gt "$MAX_LOG_SIZE" ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
    log_info "Log rotated (exceeded ${MAX_LOG_SIZE} bytes)"
  fi
}

# Health check
health_check() {
  log_info "Running health check on ${SITE_URL}..."
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${SITE_URL}" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
    log_success "Site is reachable (HTTP ${http_code})"
    return 0
  else
    log_error "Site unreachable (HTTP ${http_code})"
    return 1
  fi
}

# Run SEO audit via API
run_seo_audit() {
  log_info "Starting SEO audit via API..."

  if [ -z "$API_KEY" ]; then
    log_error "SEO_CRON_API_KEY is not set. Add it to your .env file."
    return 1
  fi

  local attempt=1
  local response=""
  local http_code=""

  while [ $attempt -le $MAX_RETRIES ]; do
    log_info "Attempt ${attempt}/${MAX_RETRIES}..."

    # Make API call
    response=$(curl -s -w "\n%{http_code}" \
      --max-time 120 \
      -X POST \
      -H "Content-Type: application/json" \
      "${SITE_URL}/api/admin/seo/cron?apiKey=${API_KEY}" 2>/dev/null) || true

    # Extract HTTP code (last line) and body (everything else)
    http_code=$(echo "$response" | tail -1)
    local body
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
      log_success "SEO audit completed successfully"

      # Parse results
      local overall_score
      overall_score=$(echo "$body" | grep -o '"overallScore":[0-9]*' | head -1 | cut -d: -f2 || echo "N/A")
      local issues_found
      issues_found=$(echo "$body" | grep -o '"issuesFound":[0-9]*' | head -1 | cut -d: -f2 || echo "N/A")
      local pages_processed
      pages_processed=$(echo "$body" | grep -o '"pagesProcessed":[0-9]*' | head -1 | cut -d: -f2 || echo "N/A")

      log_info "=========================================="
      log_info "  SEO AUDIT RESULTS"
      log_info "=========================================="
      log_info "  Overall Score:    ${overall_score}/100"
      log_info "  Pages Processed:  ${pages_processed}"
      log_info "  Issues Found:     ${issues_found}"
      log_info "=========================================="

      return 0
    elif [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
      log_error "Authentication failed (HTTP ${http_code}). Check your SEO_CRON_API_KEY."
      return 1
    else
      log_warn "Request failed (HTTP ${http_code}). Retrying in ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
      RETRY_DELAY=$((RETRY_DELAY * 2))
      attempt=$((attempt + 1))
    fi
  done

  log_error "All ${MAX_RETRIES} attempts failed"
  return 1
}

# Check sitemap accessibility
check_sitemap() {
  log_info "Checking sitemap accessibility..."
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${SITE_URL}/sitemap.xml" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ]; then
    log_success "Sitemap is accessible (HTTP ${http_code})"
  else
    log_warn "Sitemap returned HTTP ${http_code}"
  fi
}

# Check robots.txt accessibility
check_robots() {
  log_info "Checking robots.txt accessibility..."
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${SITE_URL}/robots.txt" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ]; then
    log_success "robots.txt is accessible (HTTP ${http_code})"
  else
    log_warn "robots.txt returned HTTP ${http_code}"
  fi
}

# Main execution
main() {
  echo ""
  log_info "=========================================="
  log_info "  IndieCrowdfund SEO Cron Job"
  log_info "  $(date '+%A, %B %d, %Y %I:%M %p')"
  log_info "=========================================="
  echo ""

  rotate_log

  local exit_code=0

  # Step 1: Health check
  if ! health_check; then
    log_error "Aborting: Site is not reachable"
    exit 1
  fi

  # Step 2: Check sitemap & robots
  check_sitemap
  check_robots

  # Step 3: Run SEO audit
  if ! run_seo_audit; then
    exit_code=1
  fi

  echo ""
  if [ $exit_code -eq 0 ]; then
    log_success "SEO cron job completed successfully"
  else
    log_error "SEO cron job completed with errors"
  fi

  log_info "=========================================="
  echo ""

  return $exit_code
}

# Run
main "$@"
