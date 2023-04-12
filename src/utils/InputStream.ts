/*
 *  Copyright (c) 2019-2020 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twin.life)
 */

/*
 * Derived from InputStream.java
 *  https://android.googlesource.com/platform/libcore (f8dfc9872ecc2f8c3cbc7cb747c2f010f14b3247)
 *  ojluni/src/main/java/java/io/InputStream.java
 */

/*
 * Copyright (c) 1994, 2013, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */

/**
 * This abstract class is the superclass of all classes representing
 * an input stream of bytes.
 *
 * <p> Applications that need to define a subclass of <code>InputStream</code>
 * must always provide a method that returns the next byte of input.
 *
 * @author  Arthur van Hoff
 * @see     java.io.BufferedInputStream
 * @see     java.io.ByteArrayInputStream
 * @see     java.io.DataInputStream
 * @see     java.io.FilterInputStream
 * @see     java.io.InputStream#read()
 * @see     java.io.OutputStream
 * @see     java.io.PushbackInputStream
 * @since   JDK1.0
 * @class
 */
export abstract class InputStream {
	static MAX_SKIP_BUFFER_SIZE: number = 2048;

	public read(): number {
		throw new Error("cannot invoke abstract overloaded method... check your argument(s) type(s)");
	}

	public read$byte_A(b: ArrayBuffer): number {
		return this.readBuffer(b, 0, b.byteLength);
	}

	public readBuffer(b: ArrayBuffer, off: number, len: number): number {
		if (len === 0) {
			return 0;
		}
		let c: number = this.read();
		if (c === -1) {
			return -1;
		}
		let view = new Uint8Array(b);
		view[off] = (c as number) | 0;
		let i: number = 1;
		try {
			for (; i < len; i++) {
				c = this.read();
				if (c === -1) {
					break;
				}
				view[off + i] = (c as number) | 0;
			}
		} catch (ee) {}
		return i;
	}

	/**
	 * Skips over and discards <code>n</code> bytes of data from this input
	 * stream. The <code>skip</code> method may, for a variety of reasons, end
	 * up skipping over some smaller number of bytes, possibly <code>0</code>.
	 * This may result from any of a number of conditions; reaching end of file
	 * before <code>n</code> bytes have been skipped is only one possibility.
	 * The actual number of bytes skipped is returned. If {@code n} is
	 * negative, the {@code skip} method for class {@code InputStream} always
	 * returns 0, and no bytes are skipped. Subclasses may handle the negative
	 * value differently.
	 *
	 * <p> The <code>skip</code> method of this class creates a
	 * byte array and then repeatedly reads into it until <code>n</code> bytes
	 * have been read or the end of the stream has been reached. Subclasses are
	 * encouraged to provide a more efficient implementation of this method.
	 * For instance, the implementation may depend on the ability to seek.
	 *
	 * @param      {number} n   the number of bytes to be skipped.
	 * @return     {number} the actual number of bytes skipped.
	 * @exception  IOException  if the stream does not support seek,
	 * or if some other I/O error occurs.
	 */
	public skip(n: number): number {
		let remaining: number = n;
		let nr: number;
		if (n <= 0) {
			return 0;
		}
		let size: number = (Math.min(InputStream.MAX_SKIP_BUFFER_SIZE, remaining) as number) | 0;
		let skipBuffer: ArrayBuffer = new ArrayBuffer(size);
		while (remaining > 0) {
			nr = this.readBuffer(skipBuffer, 0, (Math.min(size, remaining) as number) | 0);
			if (nr < 0) {
				break;
			}
			remaining -= nr;
		}
		return n - remaining;
	}

	/**
	 * Returns an estimate of the number of bytes that can be read (or
	 * skipped over) from this input stream without blocking by the next
	 * invocation of a method for this input stream. The next invocation
	 * might be the same thread or another thread.  A single read or skip of this
	 * many bytes will not block, but may read or skip fewer bytes.
	 *
	 * <p> Note that while some implementations of {@code InputStream} will return
	 * the total number of bytes in the stream, many will not.  It is
	 * never correct to use the return value of this method to allocate
	 * a buffer intended to hold all data in this stream.
	 *
	 * <p> A subclass' implementation of this method may choose to throw an
	 * {@link IOException} if this input stream has been closed by
	 * invoking the {@link #close()} method.
	 *
	 * <p> The {@code available} method for class {@code InputStream} always
	 * returns {@code 0}.
	 *
	 * <p> This method should be overridden by subclasses.
	 *
	 * @return     {number} an estimate of the number of bytes that can be read (or skipped
	 * over) from this input stream without blocking or {@code 0} when
	 * it reaches the end of the input stream.
	 * @exception  IOException if an I/O error occurs.
	 */
	public available(): number {
		return 0;
	}

	/**
	 * Closes this input stream and releases any system resources associated
	 * with the stream.
	 *
	 * <p> The <code>close</code> method of <code>InputStream</code> does
	 * nothing.
	 *
	 * @exception  IOException  if an I/O error occurs.
	 */
	public close() {}
}
