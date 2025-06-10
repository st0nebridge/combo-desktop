# Profile Management

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
