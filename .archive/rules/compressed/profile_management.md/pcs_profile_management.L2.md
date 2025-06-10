<!-- filepath: m:\Dev\Tools\combo-desktop\rules\compressed\profile_management.md\pcs_profile_management.L2.md -->
# PCS L2: Profile Management Operations Reference

**📊 Compression Metadata:**
- Level: L2 (Operational Reference)
- Source: `../profile_management.md`
- Timestamp: 2025-06-10
- Token Reduction: ~60%
- Preservation: Core requirements (100%), structure (100%)

**🔗 Navigation:** [Source](../profile_management.md)

## 🔧 CORE CONCEPTS
- **Profiles** = Electron session partition names
- **Session Name Pattern:** `${app.getName()}:${providerName}:${profileName}`
- **Tracking:** Simple JSON file `profiles.json`
- **Identifier Pattern:** `<provider>:<profile-name>`
- **Isolation:** Electron session partitioning

## 📋 PROFILE TYPES

### 🔹 Default Profile
- **Name:** "default"
- **Usage:** When no other profile specified
- **Behavior:** Standard fallback profile

### 🔹 Custom Profiles
- **Name:** Any name other than "default"
- **Usage:** When specific profile specified
- **Behavior:** Isolated session partition

## ⚙️ PROFILE OPTIONS
- Profile options passed to provider
- Provider-specific configuration
- Session-level settings

## 🔄 MANAGEMENT REQUIREMENTS
- ✅ JSON-based profile tracking
- ✅ Session partition isolation
- ✅ Provider-profile pairing
- ✅ Default profile fallback
- ✅ Custom profile handling

**⚠️ Preservation Statement:**
All profile management requirements and patterns preserved. Implementation details reduced for operational reference.
