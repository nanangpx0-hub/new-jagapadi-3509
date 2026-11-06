import re
p=r'apps/web/src/lib/api.ts'
s=open(p).read()
old="""    must_change_password: boolean;
    roles: string[];
    permissions: string[];
  };
}

/* ---------- Manajemen Pengguna (Admin) ---------- */"""
new="""    must_change_password: boolean;
    theme_preference?: string | null;
    roles: string[];
    permissions: string[];
  };
}

/* ---------- Manajemen Pengguna (Admin) ---------- */"""
assert old in s
s=s.replace(old,new,1)
open(p,'w').write(s)
print('done')
"""