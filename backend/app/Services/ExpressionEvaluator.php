<?php

namespace App\Services;

class ExpressionEvaluator
{
    private array $tokens = [];
    private int $pos = 0;

    public function __construct(string $expr)
    {
        preg_match_all('/(?:\d+(?:\.\d+)?|[+\-*\/()])/s', $expr, $matches);
        $this->tokens = $matches[0] ?? [];
        $this->pos = 0;
    }

    public static function evaluate(string $expr): float
    {
        $evaluator = new self($expr);
        return $evaluator->calculate();
    }

    public function calculate(): float
    {
        if (empty($this->tokens)) {
            return 0.0;
        }

        $result = $this->parseExpression();
        if ($this->pos < count($this->tokens)) {
            throw new \InvalidArgumentException('Karakter tidak valid di akhir ekspresi');
        }

        return (float) $result;
    }

    private function peek(): ?string
    {
        return $this->tokens[$this->pos] ?? null;
    }

    private function consume(): ?string
    {
        return $this->tokens[$this->pos++] ?? null;
    }

    private function parseFactor(): float
    {
        $token = $this->peek();
        if ($token === '+') {
            $this->consume();
            return $this->parseFactor();
        }
        if ($token === '-') {
            $this->consume();
            return -$this->parseFactor();
        }
        if ($token === '(') {
            $this->consume();
            $value = $this->parseExpression();
            if ($this->peek() !== ')') {
                throw new \InvalidArgumentException('Tanda kurung tidak seimbang');
            }
            $this->consume();
            return $value;
        }
        if ($token !== null && is_numeric($token)) {
            $this->consume();
            return (float) $token;
        }
        throw new \InvalidArgumentException("Token tidak valid: {$token}");
    }

    private function parseTerm(): float
    {
        $value = $this->parseFactor();
        while (true) {
            $op = $this->peek();
            if ($op !== '*' && $op !== '/') {
                break;
            }
            $this->consume();
            $right = $this->parseFactor();
            if ($op === '/') {
                if ($right == 0.0) {
                    throw new \DivisionByZeroError('Pembagian dengan nol dalam rumus');
                }
                $value = $value / $right;
            } else {
                $value = $value * $right;
            }
        }
        return $value;
    }

    private function parseExpression(): float
    {
        $value = $this->parseTerm();
        while (true) {
            $op = $this->peek();
            if ($op !== '+' && $op !== '-') {
                break;
            }
            $this->consume();
            $right = $this->parseTerm();
            $value = ($op === '+') ? ($value + $right) : ($value - $right);
        }
        return $value;
    }
}
