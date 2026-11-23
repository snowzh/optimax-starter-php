<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * 工厂默认密码（测试与本地造数用）。
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'username' => fake()->unique()->userName(),
            'name' => fake()->name(),
            'password' => static::$password ??= Hash::make('password'),
            'status' => User::STATUS_ENABLED,
        ];
    }

    /** 指定明文密码（模型 hashed cast 负责加密） */
    public function withPassword(string $password): static
    {
        return $this->state(fn (): array => [
            'password' => $password,
        ]);
    }

    /** 禁用状态的用户 */
    public function disabled(): static
    {
        return $this->state(fn (): array => [
            'status' => User::STATUS_DISABLED,
        ]);
    }
}
