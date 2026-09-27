import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd(), false);

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Sử dụng: node scripts/bootstrap-developer.mjs <email> [mật-khẩu-khi-tạo-tài-khoản-mới]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error('Lỗi: Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Đang tìm tài khoản auth cho email: ${email}...`);
  let page = 1;
  let user = null;
  while (true) {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (listError) {
      console.error('Lỗi khi truy vấn auth.users:', listError.message);
      process.exit(1);
    }
    const found = usersData.users.find(u => u.email?.toLowerCase() === email);
    if (found) {
      user = found;
      break;
    }
    if (!usersData.users || usersData.users.length < 100) {
      break;
    }
    page++;
  }

  let createdPassword = null;
  if (!user) {
    createdPassword = process.argv[3]?.trim();
    if (!createdPassword) {
      console.error('Lỗi: Cần truyền mật khẩu rõ ràng khi tạo tài khoản Developer mới.');
      process.exit(1);
    }
    console.log(`Chưa có tài khoản cho email: ${email}. Đang tự động tạo mới với mật khẩu...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: createdPassword,
      email_confirm: true,
    });
    if (createError || !createData.user) {
      console.error('Lỗi khi tạo user mới:', createError?.message || 'Không rõ lỗi');
      process.exit(1);
    }
    user = createData.user;
    console.log(`Đã tạo tài khoản auth thành công cho user ID: ${user.id}`);
  }

  console.log(`Tìm thấy user ID: ${user.id}. Đang cập nhật profiles sang role 'developer'...`);
  const { error: updateError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      role: 'developer',
      lifecycle_status: 'active',
      updated_at: new Date().toISOString(),
    });

  if (updateError) {
    console.error('Lỗi khi cập nhật bảng profiles:', updateError.message);
    process.exit(1);
  }

  // Đọc lại profile để xác minh độc lập
  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('id, role, lifecycle_status, updated_at')
    .eq('id', user.id)
    .single();

  if (readError || !profile || profile.role !== 'developer') {
    console.error('Xác minh thất bại: Profile không có role developer sau khi cập nhật.');
    process.exit(1);
  }

  console.log('✅ Thành công!');
  console.log(`- User ID: ${profile.id}`);
  console.log(`- Email: ${email}`);
  if (createdPassword) {
    console.log(`- Mật khẩu đăng nhập: ${createdPassword}`);
  }
  console.log(`- Role: ${profile.role}`);
  console.log(`- Trạng thái: ${profile.lifecycle_status}`);
  console.log('Tài khoản đã được cấp quyền Developer. Bạn có thể đăng nhập và truy cập /system-admin.');
}

main().catch(err => {
  console.error('Lỗi không xử lý được:', err);
  process.exit(1);
});
