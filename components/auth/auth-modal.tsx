"use client";

import { Dialog, Transition } from "@headlessui/react";
import { UserIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Fragment, useState } from "react";
import AuthButton from "./auth-button";
import { useAuth } from "./auth-context";
import LoginForm from "./login-form";
import RegisterForm from "./register-form";

export default function AuthModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const { customer, status, logout } = useAuth();

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const switchToLogin = () => setMode("login");
  const switchToRegister = () => setMode("register");

  const handleLogout = async () => {
    await logout();
    closeModal();
  };

  return (
    <>
      <button aria-label="Open auth" onClick={openModal}>
        <AuthButton />
      </button>
      <Transition show={isOpen}>
        <Dialog onClose={closeModal} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="transition-all ease-in-out duration-300"
            enterFrom="opacity-0 backdrop-blur-none"
            enterTo="opacity-100 backdrop-blur-[.5px]"
            leave="transition-all ease-in-out duration-200"
            leaveFrom="opacity-100 backdrop-blur-[.5px]"
            leaveTo="opacity-0 backdrop-blur-none"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="transition-all ease-in-out duration-300"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transition-all ease-in-out duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <Dialog.Panel className="fixed bottom-0 right-0 top-0 flex h-full w-full flex-col border-l border-neutral-200 bg-white/80 p-6 text-black backdrop-blur-xl md:w-[390px] dark:border-neutral-700 dark:bg-black/80 dark:text-white">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">
                  {status === "authenticated"
                    ? "My Account"
                    : mode === "login"
                      ? "Login"
                      : "Register"}
                </p>
                <button aria-label="Close auth" onClick={closeModal}>
                  <CloseAuth />
                </button>
              </div>

              {status === "authenticated" && customer ? (
                <div className="mt-8 flex flex-col space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <UserIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {customer.email}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-neutral-200 pt-6 dark:border-neutral-700">
                    <button
                      onClick={handleLogout}
                      className="w-full rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-6 flex w-full justify-center">
                    <div className="flex space-x-2">
                      <button
                        className={`px-4 py-2 font-medium ${
                          mode === "login"
                            ? "border-b-2 border-blue-600 text-blue-600"
                            : "text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
                        }`}
                        onClick={switchToLogin}
                      >
                        Login
                      </button>
                      <button
                        className={`px-4 py-2 font-medium ${
                          mode === "register"
                            ? "border-b-2 border-blue-600 text-blue-600"
                            : "text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
                        }`}
                        onClick={switchToRegister}
                      >
                        Register
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex-1 overflow-auto">
                    {mode === "login" ? (
                      <LoginForm onSuccess={closeModal} />
                    ) : (
                      <RegisterForm onSuccess={switchToLogin} />
                    )}
                  </div>
                </>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  );
}

function CloseAuth({ className }: { className?: string }) {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 text-black transition-colors dark:border-neutral-700 dark:text-white">
      <XMarkIcon className="h-6 transition-all ease-in-out hover:scale-110" />
    </div>
  );
}
