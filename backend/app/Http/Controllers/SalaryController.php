<?php

namespace App\Http\Controllers;

use App\Models\Salary;
use Illuminate\Http\Request;

class SalaryController extends Controller
{
    public function index(Request $request)
    {
        $salaries = Salary::where('user_id', $request->user()->id)
            ->where('company_id', $request->user()->company_id)
            ->orderBy('year', 'desc')
            ->orderBy('month', 'desc')
            ->paginate(10);

        return $this->successResponse($salaries, 'Data gaji berhasil diambil.');
    }
}
