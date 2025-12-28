import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper functions that mirror the logic in index.js
function normalizeVersion(version) {
  return version.startsWith('v') ? version : `v${version}`;
}

function normalizeArchitecture(arch) {
  if (arch === 'x64') {
    return 'x86_64';
  } else if (arch === 'arm64') {
    return 'arm64';
  }
  return arch;
}

function getPlatformString(platform, arch) {
  const os = platform === 'darwin' ? 'Darwin' : 'Linux';
  const architecture = normalizeArchitecture(arch);
  return `${os}_${architecture}`;
}

function buildDownloadUrl(version, platform, arch) {
  const normalizedVersion = normalizeVersion(version);
  const platformString = getPlatformString(platform, arch);
  return `https://github.com/dirathea/sstart/releases/download/${normalizedVersion}/sstart_${platformString}.tar.gz`;
}

function parseEnvOutput(output) {
  try {
    const trimmed = output.trim();
    if (!trimmed) {
      return {};
    }
    
    const envVars = JSON.parse(trimmed);
    
    if (typeof envVars !== 'object' || envVars === null || Array.isArray(envVars)) {
      throw new Error('Expected JSON object');
    }
    
    return envVars;
  } catch (error) {
    throw new Error(`Failed to parse JSON output from sstart env: ${error.message}`);
  }
}

describe('Sstart Download Process Tests', () => {
  let originalPlatform;
  let originalArch;

  beforeAll(() => {
    // Store original values
    originalPlatform = process.platform;
    originalArch = process.arch;
  });

  describe('Platform detection and URL construction', () => {
    it('should construct correct URL for darwin x64', () => {
      const version = '0.0.2';
      const url = buildDownloadUrl(version, 'darwin', 'x64');
      expect(url).toBe('https://github.com/dirathea/sstart/releases/download/v0.0.2/sstart_Darwin_x86_64.tar.gz');
    });

    it('should construct correct URL for darwin arm64', () => {
      const version = '0.0.2';
      const url = buildDownloadUrl(version, 'darwin', 'arm64');
      expect(url).toBe('https://github.com/dirathea/sstart/releases/download/v0.0.2/sstart_Darwin_arm64.tar.gz');
    });

    it('should construct correct URL for linux x64', () => {
      const version = '0.0.2';
      const url = buildDownloadUrl(version, 'linux', 'x64');
      expect(url).toBe('https://github.com/dirathea/sstart/releases/download/v0.0.2/sstart_Linux_x86_64.tar.gz');
    });

    it('should construct correct URL for linux arm64', () => {
      const version = '0.0.2';
      const url = buildDownloadUrl(version, 'linux', 'arm64');
      expect(url).toBe('https://github.com/dirathea/sstart/releases/download/v0.0.2/sstart_Linux_arm64.tar.gz');
    });

    it('should handle different versions', () => {
      expect(buildDownloadUrl('1.0.0', 'darwin', 'x64'))
        .toBe('https://github.com/dirathea/sstart/releases/download/v1.0.0/sstart_Darwin_x86_64.tar.gz');
      expect(buildDownloadUrl('v1.0.0', 'linux', 'arm64'))
        .toBe('https://github.com/dirathea/sstart/releases/download/v1.0.0/sstart_Linux_arm64.tar.gz');
    });
  });

  describe('Version normalization', () => {
    it('should add v prefix when version does not have it', () => {
      expect(normalizeVersion('0.0.2')).toBe('v0.0.2');
      expect(normalizeVersion('1.2.3')).toBe('v1.2.3');
    });

    it('should keep v prefix when version already has it', () => {
      expect(normalizeVersion('v0.0.2')).toBe('v0.0.2');
      expect(normalizeVersion('v1.2.3')).toBe('v1.2.3');
    });

    it('should handle different version formats', () => {
      expect(normalizeVersion('1.2.3')).toBe('v1.2.3');
      expect(normalizeVersion('v1.2.3')).toBe('v1.2.3');
      expect(normalizeVersion('0.1.0')).toBe('v0.1.0');
      expect(normalizeVersion('v0.1.0')).toBe('v0.1.0');
    });
  });

  describe('parseEnvOutput', () => {
    it('should parse valid JSON object', () => {
      const output = '{"KEY1":"value1","KEY2":"value2"}';
      const envVars = parseEnvOutput(output);
      
      expect(envVars).toEqual({ KEY1: 'value1', KEY2: 'value2' });
      expect(typeof envVars).toBe('object');
      expect(Array.isArray(envVars)).toBe(false);
    });

    it('should return empty object for empty string', () => {
      const output = '';
      const envVars = parseEnvOutput(output);
      expect(envVars).toEqual({});
    });

    it('should return empty object for whitespace-only string', () => {
      const output = '   \n\t  ';
      const envVars = parseEnvOutput(output);
      expect(envVars).toEqual({});
    });

    it('should throw error for invalid JSON', () => {
      const output = 'invalid json';
      expect(() => parseEnvOutput(output)).toThrow('Failed to parse JSON output from sstart env');
    });

    it('should throw error for JSON array', () => {
      const output = '["item1", "item2"]';
      expect(() => parseEnvOutput(output)).toThrow('Expected JSON object');
    });

    it('should throw error for null JSON', () => {
      const output = 'null';
      expect(() => parseEnvOutput(output)).toThrow('Expected JSON object');
    });

    it('should handle complex JSON objects', () => {
      const output = '{"NESTED":{"key":"value"},"ARRAY":[1,2,3],"STRING":"test"}';
      const envVars = parseEnvOutput(output);
      expect(envVars).toEqual({
        NESTED: { key: 'value' },
        ARRAY: [1, 2, 3],
        STRING: 'test'
      });
    });

    it('should handle JSON with whitespace', () => {
      const output = '  { "KEY": "value" }  ';
      const envVars = parseEnvOutput(output);
      expect(envVars).toEqual({ KEY: 'value' });
    });
  });

  describe('Download URL validation', () => {
    it('should use https protocol for GitHub releases', () => {
      const url = buildDownloadUrl('0.0.2', 'darwin', 'x64');
      expect(url.startsWith('https://')).toBe(true);
    });

    it('should use correct GitHub releases path', () => {
      const url = buildDownloadUrl('0.0.2', 'darwin', 'x64');
      expect(url).toContain('github.com/dirathea/sstart/releases/download');
    });

    it('should include version in URL path', () => {
      const url = buildDownloadUrl('1.2.3', 'linux', 'x64');
      expect(url).toContain('/v1.2.3/');
    });

    it('should include platform string in filename', () => {
      const url = buildDownloadUrl('0.0.2', 'darwin', 'arm64');
      expect(url).toContain('sstart_Darwin_arm64.tar.gz');
    });
  });

  describe('Platform string construction', () => {
    it('should normalize x64 to x86_64', () => {
      expect(normalizeArchitecture('x64')).toBe('x86_64');
    });

    it('should keep arm64 as arm64', () => {
      expect(normalizeArchitecture('arm64')).toBe('arm64');
    });

    it('should construct platform string correctly for darwin', () => {
      expect(getPlatformString('darwin', 'x64')).toBe('Darwin_x86_64');
      expect(getPlatformString('darwin', 'arm64')).toBe('Darwin_arm64');
    });

    it('should construct platform string correctly for linux', () => {
      expect(getPlatformString('linux', 'x64')).toBe('Linux_x86_64');
      expect(getPlatformString('linux', 'arm64')).toBe('Linux_arm64');
    });
  });

  describe('Archive path construction', () => {
    it('should construct archive path with platform string', () => {
      const platformString = 'Darwin_x86_64';
      const archivePath = `sstart_${platformString}.tar.gz`;
      expect(archivePath).toBe('sstart_Darwin_x86_64.tar.gz');
    });

    it('should construct binary path correctly', () => {
      const binaryName = 'sstart';
      expect(binaryName).toBe('sstart');
    });
  });

  describe('Integration: Renovate version updates', () => {
    let actionYmlContent;
    let renovateConfig;

    beforeAll(() => {
      // Read actual files
      const projectRoot = join(__dirname, '..');
      actionYmlContent = readFileSync(join(projectRoot, 'action.yml'), 'utf8');
      renovateConfig = JSON.parse(
        readFileSync(join(projectRoot, 'renovate.json'), 'utf8')
      );
    });

    it('should extract current version from action.yml', () => {
      // Extract version from default value using Renovate's regex pattern
      const manager = renovateConfig.regexManagers[0];
      const pattern = new RegExp(manager.matchStrings[0]);
      const match = actionYmlContent.match(pattern);
      
      expect(match).not.toBeNull();
      expect(match.groups.currentValue).toBeDefined();
      const currentVersion = match.groups.currentValue;
      
      // Verify it's a valid semver format
      expect(currentVersion).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should construct valid download URL with current version from action.yml', () => {
      // Get current version from action.yml
      const manager = renovateConfig.regexManagers[0];
      const pattern = new RegExp(manager.matchStrings[0]);
      const match = actionYmlContent.match(pattern);
      const currentVersion = match.groups.currentValue;
      
      // Test that download URL can be constructed with this version
      const url = buildDownloadUrl(currentVersion, 'darwin', 'x64');
      
      expect(url).toContain(`/v${currentVersion}/`);
      expect(url).toContain('github.com/dirathea/sstart/releases/download');
      expect(url).toMatch(/\.tar\.gz$/);
    });

    it('should handle Renovate-updated versions correctly', () => {
      // Simulate Renovate updating to various new versions
      const testVersions = ['0.0.3', '0.1.0', '1.0.0', '1.2.3', '2.0.0'];
      
      testVersions.forEach(version => {
        // Test that the version normalization works
        const normalized = normalizeVersion(version);
        expect(normalized).toBe(`v${version}`);
        
        // Test that URL construction works with new version
        const url = buildDownloadUrl(version, 'linux', 'x64');
        expect(url).toContain(`/v${version}/`);
        expect(url).toBe(`https://github.com/dirathea/sstart/releases/download/v${version}/sstart_Linux_x86_64.tar.gz`);
      });
    });

    it('should handle versions with v prefix from Renovate', () => {
      // Renovate might update with or without v prefix
      const versionsWithV = ['v0.0.3', 'v0.1.0', 'v1.0.0'];
      
      versionsWithV.forEach(version => {
        const normalized = normalizeVersion(version);
        expect(normalized).toBe(version); // Should keep v prefix
        
        const url = buildDownloadUrl(version, 'darwin', 'arm64');
        expect(url).toContain(`/${version}/`);
      });
    });

    it('should verify both Renovate regex managers extract same version', () => {
      const manager1 = renovateConfig.regexManagers[0];
      const manager2 = renovateConfig.regexManagers[1];
      
      const pattern1 = new RegExp(manager1.matchStrings[0]);
      const pattern2 = new RegExp(manager2.matchStrings[0]);
      
      const match1 = actionYmlContent.match(pattern1);
      const match2 = actionYmlContent.match(pattern2);
      
      expect(match1).not.toBeNull();
      expect(match2).not.toBeNull();
      
      const version1 = match1.groups.currentValue;
      const version2 = match2.groups.currentValue;
      
      // Both should extract the same version
      expect(version1).toBe(version2);
      
      // Both versions should work with download URL construction
      expect(buildDownloadUrl(version1, 'linux', 'x64'))
        .toBe(buildDownloadUrl(version2, 'linux', 'x64'));
    });

    it('should validate that updated version format is compatible with download logic', () => {
      // Simulate Renovate updating action.yml to a new version
      const newVersion = '0.0.5';
      
      // Extract version using Renovate's pattern (simulating what Renovate would match)
      const manager = renovateConfig.regexManagers[0];
      const pattern = new RegExp(manager.matchStrings[0]);
      
      // Create a test action.yml content with new version
      const updatedActionYml = actionYmlContent.replace(
        pattern,
        `default: '${newVersion}'`
      );
      
      // Verify the new version can be extracted
      const newMatch = updatedActionYml.match(pattern);
      expect(newMatch).not.toBeNull();
      expect(newMatch.groups.currentValue).toBe(newVersion);
      
      // Verify download URL can be constructed with new version
      const url = buildDownloadUrl(newVersion, 'darwin', 'x64');
      expect(url).toBe(`https://github.com/dirathea/sstart/releases/download/v${newVersion}/sstart_Darwin_x86_64.tar.gz`);
    });

    it('should work with all supported platforms after version update', () => {
      const testVersion = '1.0.0';
      const platforms = [
        { platform: 'darwin', arch: 'x64', expected: 'Darwin_x86_64' },
        { platform: 'darwin', arch: 'arm64', expected: 'Darwin_arm64' },
        { platform: 'linux', arch: 'x64', expected: 'Linux_x86_64' },
        { platform: 'linux', arch: 'arm64', expected: 'Linux_arm64' },
      ];
      
      platforms.forEach(({ platform, arch, expected }) => {
        const url = buildDownloadUrl(testVersion, platform, arch);
        expect(url).toContain(`sstart_${expected}.tar.gz`);
        expect(url).toContain(`/v${testVersion}/`);
      });
    });
  });

  afterAll(() => {
    // Restore original values if needed
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
    Object.defineProperty(process, 'arch', { value: originalArch, writable: true });
  });
});

