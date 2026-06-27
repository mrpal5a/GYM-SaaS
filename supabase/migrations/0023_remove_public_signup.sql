-- 0023_remove_public_signup.sql
-- Gyms are now created only by a super_admin via admin_create_gym_with_owner.
-- Close the public self-service path at the database too: revoke execute on the
-- old create_gym_with_owner RPC so even a crafted authenticated API call can't
-- create a gym. (The function is left in place for history; only the grant is
-- removed.) Pair this with disabling "Allow new users to sign up" in the
-- Supabase Auth settings.
revoke execute on function public.create_gym_with_owner(uuid, text, text, text, text)
  from authenticated;
