Pod::Spec.new do |s|
  s.name           = 'IcloudDrive'
  s.version        = '1.0.0'
  s.summary        = 'Reads and writes the app\'s iCloud Drive folder (encrypted backups)'
  s.description    = 'Sanguine local module: files in the app\'s iCloud Drive container, nothing else.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
