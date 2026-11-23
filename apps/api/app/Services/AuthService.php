<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\AuditLogRepository;
use App\Repositories\UserRepository;
use App\Support\BusinessException;
use App\Support\ErrorCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * 认证业务：用户名 + 密码登录、注销、当前用户、改密。
 * 登录失败不区分「用户不存在/密码错误」，避免泄漏用户存在性。
 */
class AuthService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly AuditLogRepository $audit,
    ) {}

    /**
     * 登录成功返回 [明文 token, 用户]；失败抛业务异常。
     *
     * @return array{0: string, 1: User}
     */
    public function login(string $username, string $password): array
    {
        $user = $this->users->findByUsername($username);

        if ($user === null || ! Hash::check($password, $user->password)) {
            // 不写入请求方提交的密码等敏感值；用户不存在时 user_id 为空
            $this->audit->create([
                'user_id' => $user?->id,
                'action' => 'auth.login.failed',
                'subject_type' => 'user',
                'subject_id' => $user?->id,
                'detail' => ['username' => $username],
            ]);

            throw new BusinessException(ErrorCode::BadCredentials, '用户名或密码错误');
        }

        if ($user->status !== User::STATUS_ENABLED) {
            $this->audit->create([
                'user_id' => $user->id,
                'action' => 'auth.login.blocked',
                'subject_type' => 'user',
                'subject_id' => $user->id,
                'detail' => ['username' => $username, 'status' => $user->status],
            ]);

            throw new BusinessException(ErrorCode::UserDisabled, '用户已禁用');
        }

        return DB::transaction(function () use ($user, $username): array {
            $token = $user->createToken('auth');

            $user->forceFill(['last_login_at' => now()])->save();

            $this->audit->create([
                'user_id' => $user->id,
                'action' => 'auth.login',
                'subject_type' => 'user',
                'subject_id' => $user->id,
                'detail' => ['username' => $username, 'token_id' => $token->accessToken->id],
            ]);

            return [$token->plainTextToken, $user->refresh()];
        });
    }

    /** 注销：仅删除当前 token（不注销其他端），并记审计 */
    public function logout(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $tokenId = $user->currentAccessToken()?->id;

            $user->currentAccessToken()?->delete();

            $this->audit->create([
                'user_id' => $user->id,
                'action' => 'auth.logout',
                'subject_type' => 'user',
                'subject_id' => $user->id,
                'detail' => ['username' => $user->username, 'token_id' => $tokenId],
            ]);
        });
    }

    /**
     * 修改自己的密码：旧密码校验通过后更新，并吊销除当前外的全部 token。
     * detail 快照不落新密码，仅记录 password_reset 标记。
     */
    public function changePassword(User $user, string $oldPassword, string $newPassword): void
    {
        if (! Hash::check($oldPassword, $user->password)) {
            throw new BusinessException(ErrorCode::OldPasswordMismatch, '旧密码错误');
        }

        DB::transaction(function () use ($user, $newPassword): void {
            $currentTokenId = $user->currentAccessToken()?->id;

            $user->forceFill(['password' => $newPassword])->save();

            // 防止旧密码泄露的会话继续存活：吊销除当前端外的全部 token
            $user->tokens()->whereKeyNot($currentTokenId)->delete();

            $this->audit->create([
                'user_id' => $user->id,
                'action' => 'auth.password',
                'subject_type' => 'user',
                'subject_id' => $user->id,
                'detail' => ['username' => $user->username, 'password_reset' => true],
            ]);
        });
    }
}
