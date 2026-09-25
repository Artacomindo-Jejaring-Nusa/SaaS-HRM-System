"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, X, Check } from "lucide-react";

export interface SupervisorOption {
  id: number;
  name: string;
  role?: { id: number; name: string } | string;
}

interface SearchableSupervisorSelectProps {
  value: number | null | undefined;
  onChange: (id: number | null) => void;
  supervisors: SupervisorOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableSupervisorSelect({
  value,
  onChange,
  supervisors,
  placeholder = "Tanpa Atasan",
  disabled = false,
}: Readonly<SearchableSupervisorSelectProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to format supervisor label
  const getSupervisorLabel = (emp: SupervisorOption) => {
    const roleName = typeof emp.role === "object" ? emp.role?.name : emp.role;
    return roleName ? `[${roleName}] — ${emp.name}` : emp.name;
  };

  // Find currently selected supervisor object
  const selectedSupervisor = supervisors.find((s) => s.id === value);
  const selectedDisplayLabel = selectedSupervisor
    ? getSupervisorLabel(selectedSupervisor)
    : "";

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter supervisors based on searchQuery
  const searchLower = searchQuery.toLowerCase().trim();
  const filteredSupervisors = supervisors.filter((emp) => {
    if (!searchLower) return true;
    const roleName =
      (typeof emp.role === "object" ? emp.role?.name : emp.role)?.toLowerCase() ||
      "";
    const empName = emp.name.toLowerCase();
    return roleName.includes(searchLower) || empName.includes(searchLower);
  });

  const handleSelect = (id: number | null) => {
    onChange(id);
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    if (!isOpen) setIsOpen(true);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          className="w-full px-3 py-2 pr-16 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] bg-white transition-colors cursor-text"
          placeholder={isOpen ? "Ketik jabatan/nama untuk mencari..." : (selectedDisplayLabel || placeholder)}
          value={isOpen ? searchQuery : (selectedDisplayLabel || "")}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
        />
        <div className="absolute right-2 flex items-center gap-1 text-gray-400">
          {value !== null && value !== undefined && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-gray-600 rounded-full transition-colors"
              title="Hapus Atasan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!isOpen) {
                inputRef.current?.focus();
              }
              setIsOpen(!isOpen);
            }}
            className="p-1 hover:text-gray-600 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto py-1 text-sm">
          {/* Option: Tanpa Atasan */}
          {(!searchLower || "tanpa atasan".includes(searchLower)) && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full text-left px-3 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                value === null || value === undefined
                  ? "bg-gray-100 font-semibold text-gray-900"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="italic text-gray-500">Tanpa Atasan</span>
              {(value === null || value === undefined) && (
                <Check className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}

          {/* Supervisor List */}
          {filteredSupervisors.map((emp) => {
            const label = getSupervisorLabel(emp);
            const isSelected = value === emp.id;

            return (
              <button
                type="button"
                key={emp.id}
                onClick={() => handleSelect(emp.id)}
                className={`w-full text-left px-3 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-red-50 font-medium text-[#8B0000]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{label}</span>
                {isSelected && <Check className="w-4 h-4 text-[#8B0000]" />}
              </button>
            );
          })}

          {filteredSupervisors.length === 0 && searchLower && !"tanpa atasan".includes(searchLower) && (
            <div className="px-3 py-3 text-xs text-gray-400 italic text-center">
              Tidak ada atasan yang cocok dengan "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
