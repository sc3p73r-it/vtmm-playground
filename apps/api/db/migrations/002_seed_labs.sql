INSERT INTO labs (slug, title, content_md)
VALUES
  (
    'linux-basics',
    'Linux Basics',
    '# Linux Basics\n\nTry these:\n\n- `pwd`\n- `ls -la`\n- `cd /workspace`\n- `mkdir demo && cd demo`\n- `echo hello > hello.txt`\n- `cat hello.txt`\n'
  ),
  (
    'permissions',
    'File Permissions',
    '# File Permissions\n\nTry:\n\n- `touch file.txt`\n- `ls -l`\n- `chmod 600 file.txt`\n- `chmod 644 file.txt`\n- `umask`\n'
  ),
  (
    'processes',
    'Process Management',
    '# Process Management\n\nTry:\n\n- `ps aux | head`\n- `sleep 30 &`\n- `jobs`\n- `kill %1`\n'
  ),
  (
    'networking',
    'Networking Commands',
    '# Networking Commands\n\nTry:\n\n- `ip a`\n- `ip r`\n- `curl -I https://example.com`\n\nIf outbound networking is restricted in your deployment, some commands may fail.\n'
  )
ON CONFLICT (slug) DO NOTHING;

